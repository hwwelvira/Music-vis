import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';

// ── Module-scope pure helpers (allocated once, never re-created) ───────────
const _parseHex = (hex) => {
  if (!hex || typeof hex !== 'string' || hex[0] !== '#') return [168, 216, 185];
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
};
const _blendHex = (c1, c2, r) => {
  try {
    const [r1,g1,b1] = _parseHex(c1), [r2,g2,b2] = _parseHex(c2);
    return `rgb(${Math.round(r1+(r2-r1)*r)},${Math.round(g1+(g2-g1)*r)},${Math.round(b1+(b2-b1)*r)})`;
  } catch(e) { return c1 || '#A8D8B9'; }
};

const BASE_COLORS = ['#A8D8B9','#B4A6CD','#A2CBE6','#F1A5B4','#DDE29F','#F3D291','#E7AB87'];
const RIBBON_R = 68.1818; // inner arc radius in polar units
const ANIM_DURATION = 550; // ms
const ANIM_SOFT = 0.18;   // soft edge width for sweep

const ToggleableChordRadar = ({ 
  sunburstData, 
  graphData, 
  radarFeatures, 
  radarName, 
  indicatorNames, 
  featureMaxes, 
  scatterData, 
  onNodeHover, 
  onNodeClick, 
  isVertical = false,
  viewMode = 'both',
  hoveredCategory: externalHoveredCategory,
  setHoveredCategory: externalSetHoveredCategory,
  selectedSong = null // 接收外层单曲选中状态以实现视图冰冻
}) => {
  const [localHoveredCategory, setLocalHoveredCategory] = useState(null);
  const hoveredCategory = externalHoveredCategory !== undefined ? externalHoveredCategory : localHoveredCategory;
  const setHoveredCategory = externalSetHoveredCategory !== undefined ? externalSetHoveredCategory : setLocalHoveredCategory;

  // 完美解决原生 ECharts 事件绑定闭包陷阱的外部状态指针，确保事件触发时读取最新状态
  const selectedSongRef = useRef(selectedSong);
  useEffect(() => {
    selectedSongRef.current = selectedSong;
  }, [selectedSong]);

  // ECharts instance ref – for direct imperative updates during animation
  const echartsRef    = useRef(null);
  // Per-ribbon color info read by renderItem (written in useMemo, read in renderItem + RAF)
  const colorInfoRef  = useRef([]);
  // Base ribbon geometry (4 arc values) – cached here so RAF never calls getOption()
  const ribbonBaseRef = useRef([]);
  const rafRef        = useRef(null);

  // States for dynamic representative song covers
  const [repSong, setRepSong] = useState(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [isLoadingCover, setIsLoadingCover] = useState(false);
  const cacheRef = useRef({}); // Cache object to store { 'Title - Artist': 'CoverURL' }

  const i18n = {
    danceability:'可舞度', energy:'能量', acousticness:'声学度', valence:'愉悦度',
    liveness:'现场感', instrumentalness:'器乐度', speechiness:'言语度'
  };

  const getHash = (str) => {
    let hash = 0;
    if (!str) return hash;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // REPRESENTATIVE SONG EXTRACTION WITH PARENT-BACKOFF & HASH DIVERSIFICATION
  // ─────────────────────────────────────────────────────────────────────────
  const getRepresentativeSong = (genreName) => {
    if (!scatterData || !genreName) return null;

    // Normalize genre name: remove line breaks, spaces, convert to lowercase
    const cleanGenre = genreName.replace(/\n/g, ' ').toLowerCase().trim();

    // 1. First-tier match: Direct match or substring match on the child genre
    let matchedSongs = scatterData.filter(song => {
      const songGenre = String(song[4] || '').replace(/\n/g, ' ').toLowerCase().trim();
      
      if (songGenre === cleanGenre) return true;
      
      // 🛡️ 大类防反向污染子类规则：
      // 如果歌曲流派是简短的大类汉字（如“流行”、“民谣”，长度 <= 2），且与悬停流派名（如“华语流行”、“流行摇滚”）不一致，
      // 则强行拒绝模糊匹配，防止像 Sam Smith/Olivia Rodrigo 的英文流行歌被误装进“华语流行”中。
      const isShortParentGenre = /[\u4e00-\u9fa5]+/.test(songGenre) && songGenre.length <= 2;
      if (isShortParentGenre && cleanGenre !== songGenre) {
        return false;
      }
      
      if (songGenre.includes(cleanGenre) || cleanGenre.includes(songGenre)) {
        return true;
      }
      
      // If genre has hyphen or space (e.g. "trip-hop"), match sub-parts
      const subParts = cleanGenre.split(/[\s-_]+/);
      if (subParts.length > 1) {
        return subParts.every(part => part.length > 2 && songGenre.includes(part));
      }
      return false;
    });

    // 2. Second-tier parent backoff: If child genre has 0 matching songs, backoff to its top-level parent genre
    if (matchedSongs.length === 0 && sunburstData) {
      let parentCategory = null;
      sunburstData.forEach(parent => {
        if (parent.name === genreName) {
          parentCategory = parent.name;
        } else if (parent.children) {
          const hasChild = parent.children.some(c => c.name === genreName);
          if (hasChild) {
            parentCategory = parent.name;
          }
        }
      });

      if (parentCategory) {
        const cleanParent = parentCategory.toLowerCase().replace(/\n/g, ' ').trim();
        matchedSongs = scatterData.filter(song => {
          const songGenre = String(song[4] || '').replace(/\n/g, ' ').toLowerCase().trim();
          return (
            songGenre === cleanParent ||
            songGenre.includes(cleanParent) ||
            cleanParent.includes(songGenre)
          );
        });
      }
    }

    // 3. Third-tier fallback: Global backup if still no songs found (ensures we NEVER return empty card)
    if (matchedSongs.length === 0) {
      matchedSongs = scatterData;
    }

    if (matchedSongs.length === 0) return null;

    // 4. Sort matching songs by popularity descending and slice top 30 hits
    const sorted = [...matchedSongs].sort((a, b) => (b[5] || 0) - (a[5] || 0));
    const topCandidates = sorted.slice(0, 30);

    // 5. Modulo dispersion using deterministic string hashing of the genre name.
    // This perfectly ensures that sister subgenres (e.g. indie-pop vs post-teen pop) 
    // select distinct songs from the Top 30 pool, making the visual experience highly diverse!
    const hash = getHash(genreName);
    const index = hash % topCandidates.length;
    const topSong = topCandidates[index];

    return {
      title: topSong[2],
      artist: topSong[3],
      genre: topSong[4],
      popularity: topSong[5]
    };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // COVER ARTWORK FETCHING (iTunes Search API - anonymous, free, CORS-friendly)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hoveredCategory) {
      // Fade out background and song info slightly delayed for smooth transition
      const timer = setTimeout(() => {
        setRepSong(null);
        setCoverUrl('');
      }, 300);
      return () => clearTimeout(timer);
    }

    const song = getRepresentativeSong(hoveredCategory);
    if (!song) {
      setRepSong(null);
      setCoverUrl('');
      return;
    }

    setRepSong(song);

    const cacheKey = `${song.title}-${song.artist}`;
    if (cacheRef.current[cacheKey]) {
      setCoverUrl(cacheRef.current[cacheKey]);
      return;
    }

    // Debounce API requests (300ms) to avoid request flooding on fast sweep
    const debounceTimer = setTimeout(() => {
      setIsLoadingCover(true);
      const query = encodeURIComponent(`${song.title} ${song.artist}`);
      const url = `https://itunes.apple.com/search?term=${query}&limit=1&entity=song`;

      fetch(url)
        .then(res => res.json())
        .then(resData => {
          if (resData.results && resData.results.length > 0) {
            const track = resData.results[0];
            // Swap 100x100 artwork with 600x600 for high resolution aesthetic
            const highResUrl = track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : '';
            if (highResUrl) {
              cacheRef.current[cacheKey] = highResUrl;
              setCoverUrl(highResUrl);
            } else {
              setCoverUrl('https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&auto=format&fit=crop&q=60');
            }
          } else {
            setCoverUrl('https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&auto=format&fit=crop&q=60');
          }
        })
        .catch(err => {
          console.error("Failed to fetch artwork from iTunes API:", err);
          // 完美的断网/超时霓虹音浪降级占位图，确保视觉不穿帮
          setCoverUrl('https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&auto=format&fit=crop&q=60');
        })
        .finally(() => {
          setIsLoadingCover(false);
        });
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [hoveredCategory, scatterData]);

  // ─────────────────────────────────────────────────────────────────────────
  // LEFT CHART OPTION
  // ─────────────────────────────────────────────────────────────────────────
  const chordOptions = useMemo(() => {
    if (!graphData || !sunburstData) return {};

    // Build angle ranges & color map
    let cumVal = 0;
    const angleRanges = {}, catColors = {};
    sunburstData.forEach((root, i) => {
      const col = BASE_COLORS[i % BASE_COLORS.length];
      catColors[root.name] = col;
      (root.children || []).forEach(child => {
        angleRanges[child.name] = [cumVal, cumVal + child.value];
        catColors[child.name]   = col;
        cumVal += child.value;
      });
    });
    const totalValue = cumVal || 1;

    const nodeCatMap = {};
    graphData.nodes.forEach(n => { nodeCatMap[n.name] = n.category; });

    let ribbonData = [];
    let highlightNames = new Set();

    if (hoveredCategory) {
      const validNames = new Set([hoveredCategory]);
      const rootCat = sunburstData.find(c => c.name === hoveredCategory);
      (rootCat?.children || []).forEach(c => validNames.add(c.name));

      const links = graphData.links.filter(l =>
        validNames.has(l.source) // Only links starting FROM current hovered category
      );

      highlightNames = new Set(validNames);
      links.forEach(l => {
        highlightNames.add(l.source); highlightNames.add(l.target);
        highlightNames.add(nodeCatMap[l.source]); highlightNames.add(nodeCatMap[l.target]);
      });

      const linkCounts = {};
      let minSim = Infinity, maxSim = -Infinity;
      links.forEach(l => {
        linkCounts[l.source] = (linkCounts[l.source] || 0) + 1;
        linkCounts[l.target] = (linkCounts[l.target] || 0) + 1;
        if (l.value < minSim) minSim = l.value;
        if (l.value > maxSim) maxSim = l.value;
      });
      const simRange = maxSim - minSim || 1;

      const offsets = {};
      const newColorInfo = [];
      ribbonData = links.map((l, idx) => {
        // Source side geometry
        const [ss, se] = angleRanges[l.source] || [0,1];
        const so = offsets[l.source] || 0;
        const aw = (1 / (linkCounts[l.source] || 1)) * (se - ss);
        offsets[l.source] = so + aw;
        const srcStart = ss + so, srcEnd = srcStart + aw;

        // Target side geometry
        const [ts, te] = angleRanges[l.target] || [0,1];
        const to2 = offsets[l.target] || 0;
        const bw  = (1 / (linkCounts[l.target] || 1)) * (te - ts);
        offsets[l.target] = to2 + bw;
        const tgtStart = ts + to2, tgtEnd = tgtStart + bw;

        const normSim = (l.value - minSim) / simRange;
        const targetOpacity = 0.25 + normSim * 0.6;

        let srcColor = catColors[l.source] || '#FF8E8B';
        const tgtColor = catColors[l.target] || '#FF8E8B';
        const isSourceStart = validNames.has(l.source);

        const altColors = ['#A2CBE6', '#F3D291', '#F1A5B4'];
        srcColor = _blendHex(srcColor, altColors[idx % 3], 0.75);

        newColorInfo.push({
          fromColor: isSourceStart ? srcColor : tgtColor,
          toColor:   isSourceStart ? tgtColor : srcColor,
          isSourceStart,
          targetOpacity
        });

        const item = { value: [srcStart, srcEnd, tgtStart, tgtEnd, 0], itemStyle: { opacity: targetOpacity } };
        return item;
      });

      colorInfoRef.current  = newColorInfo;
      ribbonBaseRef.current = ribbonData.map(d => d.value.slice(0, 4));
    } else {
      colorInfoRef.current  = [];
      ribbonBaseRef.current = [];
    }

    const isSmall = hoveredCategory && !!nodeCatMap[hoveredCategory];
    const getOp = (name, isRoot) => {
      if (!hoveredCategory) return 1;
      if (!highlightNames.has(name)) return 0.15;
      if (isRoot && isSmall) return 0.45;
      return 1;
    };
    const activeSunburst = sunburstData.map(root => ({
      ...root,
      itemStyle: { ...root.itemStyle, opacity: getOp(root.name, true) },
      children: (root.children || []).map(c => ({
        ...c, itemStyle: { ...c.itemStyle, opacity: getOp(c.name, false) }
      }))
    }));

    return {
      color: BASE_COLORS,
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#EEEEEE',
        padding: [6, 10],
        textStyle: { color: '#333333', fontSize: 10, fontFamily: '"Outfit","Inter",sans-serif' },
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 6px;',
        position: function (point, params, dom, rect, size) {
          const viewWidth = size.viewSize[0];
          const viewHeight = size.viewSize[1];
          const cx = viewWidth / 2;
          const cy = viewHeight / 2;
          
          const [mx, my] = point;
          const [tw, th] = size.contentSize;
          const offset = 15;

          let x = mx > cx ? mx + offset : mx - tw - offset;
          let y = my > cy ? my + offset : my - th - offset;

          if (x < 0) x = 0;
          if (x + tw > viewWidth) x = viewWidth - tw;
          if (y < 0) y = 0;
          if (y + th > viewHeight) y = viewHeight - th;

          return [x, y];
        }
      },
      polar:      { center: ['50%','50%'], radius: viewMode === 'sunburst' ? '92%' : (isVertical ? '76%' : '88%') },
      angleAxis:  { type:'value', startAngle:90, clockwise:true, min:0, max:totalValue, show:false },
      radiusAxis: { type:'value', min:0, max:100, show:false },
      series: [
        {
          name: '流派层级关系', type: 'sunburst',
          data: activeSunburst, sort: null, radius: viewMode === 'sunburst' ? ['38%', '92%'] : (isVertical ? ['30%', '76%'] : ['38%','88%']),
          nodeClick: false,
          tooltip: { formatter: '<span style="font-weight:bold;">{b}</span><br/><span style="color:#666;font-size:12px;">曲库样本规模：{c} 首</span>' },
          emphasis: { focus: 'none' },
          itemStyle: { borderRadius:4, borderWidth:2, borderColor:'#FFFFFF' },
          label: { show: false },
          levels: [
            {},
            { r0: viewMode === 'sunburst' ? '38%' : (isVertical ? '30%' : '38%'), r: viewMode === 'sunburst' ? '62%' : (isVertical ? '50%' : '60%'), itemStyle:{borderWidth:2} },
            { r0: viewMode === 'sunburst' ? '62%' : (isVertical ? '50%' : '60%'), r: viewMode === 'sunburst' ? '94%' : (isVertical ? '78%' : '92%'), itemStyle:{borderWidth:1} }
          ],
          z: 2
        },
        {
          id: 'ribbon-custom',
          name: '特征相似度弦带', type: 'custom', silent: true,
          coordinateSystem: 'polar',
          renderItem: (params, api) => {
            const center = api.coord([0,0]);
            const edgeP  = api.coord([RIBBON_R, 0]);
            const pixR   = Math.sqrt((edgeP[0]-center[0])**2 + (edgeP[1]-center[1])**2);

            const p1 = api.coord([RIBBON_R, api.value(0)]);
            const p2 = api.coord([RIBBON_R, api.value(1)]);
            const p3 = api.coord([RIBBON_R, api.value(2)]);
            const p4 = api.coord([RIBBON_R, api.value(3)]);
            const t  = api.value(4);

            const info        = colorInfoRef.current[params.dataIndex] || {};
            const fromColor   = info.fromColor || '#A8D8B9';
            const toColor     = info.toColor   || '#B4A6CD';
            const isSrcStart  = info.isSourceStart ?? true;

            const srcX = (p1[0]+p2[0])/2, srcY = (p1[1]+p2[1])/2;
            const tgtX = (p3[0]+p4[0])/2, tgtY = (p3[1]+p4[1])/2;
            const fx = isSrcStart ? srcX : tgtX, fy = isSrcStart ? srcY : tgtY;
            const tx = isSrcStart ? tgtX : srcX, ty = isSrcStart ? tgtY : srcY;

            const es = Math.max(0, t - ANIM_SOFT), ee = Math.min(1, t);
            const colorStops = t >= 1
              ? [{ offset:0, color: fromColor }, { offset:1, color: toColor }]
              : [
                  { offset:0,  color: fromColor },
                  { offset:es, color: _blendHex(fromColor, toColor, es) },
                  { offset:ee, color: 'rgba(200,200,200,0)' },
                  { offset:1,  color: 'rgba(200,200,200,0)' }
                ];

            const style = api.style();
            style.fill    = { type:'linear', x:fx, y:fy, x2:tx, y2:ty, global:true, colorStops };
            style.opacity = info.targetOpacity !== undefined ? info.targetOpacity : 0.75;
            
            style.stroke = 'rgba(255, 255, 255, 0.4)';
            style.lineWidth = 1.5;

            return {
              type: 'path',
              shape: { pathData: `M ${p1[0]} ${p1[1]} A ${pixR} ${pixR} 0 0 1 ${p2[0]} ${p2[1]} Q ${center[0]} ${center[1]} ${p3[0]} ${p3[1]} A ${pixR} ${pixR} 0 0 1 ${p4[0]} ${p4[1]} Q ${center[0]} ${center[1]} ${p1[0]} ${p1[1]} Z` },
              style
            };
          },
          data: ribbonData,
          z: 5
        },
        {
          name: '流派文字标签', type: 'sunburst',
          data: activeSunburst, sort: null, radius: viewMode === 'sunburst' ? ['38%', '92%'] : (isVertical ? ['30%', '76%'] : ['38%','88%']),
          nodeClick: false,
          silent: true,
          tooltip: { show: false },
          emphasis: { focus: 'none' },
          itemStyle: { color: 'transparent', borderColor: 'transparent', borderWidth: 0, opacity: 0 },
          label: { show:true, color:'#333333', textBorderColor:'rgba(255,255,255,0.7)', textBorderWidth:2, fontFamily:'"Outfit","Inter",sans-serif', lineHeight:16 },
          levels: [
            {},
            { r0: viewMode === 'sunburst' ? '38%' : (isVertical ? '30%' : '38%'), r: viewMode === 'sunburst' ? '62%' : (isVertical ? '50%' : '60%'), itemStyle:{color:'transparent',borderColor:'transparent'}, label:{rotate:'tangential',fontSize: viewMode === 'sunburst' ? 12 : (isVertical ? 9 : 12),fontWeight:'bold'} },
            { r0: viewMode === 'sunburst' ? '62%' : (isVertical ? '50%' : '60%'), r: viewMode === 'sunburst' ? '94%' : (isVertical ? '78%' : '92%'), itemStyle:{color:'transparent',borderColor:'transparent'}, label:{position:'inside',fontSize: viewMode === 'sunburst' ? 10 : (isVertical ? 8 : 10),minAngle:3} }
          ],
          z: 10
        }
      ]
    };
  }, [sunburstData, graphData, hoveredCategory]);

  // ─────────────────────────────────────────────────────────────────────────
  // RAF ANIMATION
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (!hoveredCategory) return;

    let startTime = null;

    const tick = (ts) => {
      if (!startTime) startTime = ts;
      const raw = Math.min((ts - startTime) / ANIM_DURATION, 1);
      const t = raw < 0.5 ? 2 * raw * raw : 1 - (-2 * raw + 2) ** 2 / 2;

      const ec = echartsRef.current?.getEchartsInstance?.();
      const base = ribbonBaseRef.current;
      if (ec && base.length > 0) {
        const newData = base.map((geo, i) => {
          const op = colorInfoRef.current[i]?.targetOpacity || 0.75;
          return {
            value: [geo[0], geo[1], geo[2], geo[3], t],
            itemStyle: { opacity: op }
          };
        });
        ec.setOption({ series: [{ id: 'ribbon-custom', data: newData }] });
      }

      if (raw < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const ec = echartsRef.current?.getEchartsInstance?.();
      if (ec) ec.setOption({ series: [{ id: 'ribbon-custom', data: [] }] });
    };
  }, [hoveredCategory]);

  // 终极联动方案：在 hoveredCategory 改变时，直接通过原生 API 强行派发官方的 highlight / downplay 动作
  // 这不仅 100% 确保旭日图高亮扇区瞬间点亮，更触发了 ECharts 原生极为华丽的“扇区轻微放大与描边加粗”的物理质感，
  // 并且通过 60ms 的轻微延时完美避开了 60FPS 的 RAF 渲染竞争冲突，体验一流！
  useEffect(() => {
    const timer = setTimeout(() => {
      const ec = echartsRef.current?.getEchartsInstance?.();
      if (!ec) return;

      if (hoveredCategory) {
        // 1. 先清除此前遗留的其它高亮状态
        ec.dispatchAction({
          type: 'downplay',
          seriesIndex: [0, 2]
        });
        
        // 2. 向旭日图及其文字标签强行派发 'highlight' 动作点亮该流派
        ec.dispatchAction({
          type: 'highlight',
          seriesIndex: [0, 2],
          name: hoveredCategory
        });
      } else {
        // 3. 复位清空
        ec.dispatchAction({
          type: 'downplay',
          seriesIndex: [0, 2]
        });
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [hoveredCategory]);

  // ─────────────────────────────────────────────────────────────────────────
  // RIGHT CHART: Standalone Radar
  // ─────────────────────────────────────────────────────────────────────────
  const radarOptions = useMemo(() => {
    if (!radarFeatures || !indicatorNames?.length) return {};
    
    const nodeCatMap = {};
    if (graphData?.nodes) {
      graphData.nodes.forEach(n => { nodeCatMap[n.name] = n.category; });
    }

    const currentName = hoveredCategory || radarName;
    const currentCatRaw = currentName ? nodeCatMap[currentName] : null;
    let mainSeriesName = currentName || '当前选择流派';
    if (currentCatRaw) {
      const catClean = currentCatRaw.split('\n')[0];
      mainSeriesName = `${currentName} (${catClean})`;
    }

    const radarSeriesData = [{ 
      value: indicatorNames.map(k => radarFeatures[k] || 0), 
      name: mainSeriesName, 
      symbol: 'circle',
      symbolSize: (viewMode === 'radar' || isVertical) ? 4 : 6,
      areaStyle: {color:'rgba(168,216,185,0.45)'}, 
      lineStyle: {width:3,color:'#88B04B'}, 
      itemStyle: {color:'#88B04B'} 
    }];

    if (hoveredCategory && graphData?.links && graphData?.nodes) {
      const isSubcategory = graphData.nodes.some(n => n.name === hoveredCategory);
      if (isSubcategory) {
        const outLinks = graphData.links
          .filter(l => l.source === hoveredCategory)
          .sort((a, b) => b.value - a.value);

        const altColors = ['#A2CBE6', '#F3D291', '#F1A5B4'];
        const opacities = [1.0, 0.6, 0.3];

        outLinks.forEach((l, idx) => {
          const targetNode = graphData.nodes.find(n => n.name === l.target);
          if (targetNode && targetNode.features) {
            const color = altColors[idx % 3];
            const opacity = opacities[idx % 3];
            const catName = (nodeCatMap[l.target] || '未知').split('\n')[0];
            radarSeriesData.push({
              value: indicatorNames.map(k => targetNode.features[k] || 0),
              name: `${l.target} (${catName})`,
              symbol: 'circle',
              symbolSize: (viewMode === 'radar' || isVertical) ? 3 : 5,
              areaStyle: { color: 'transparent' },
              lineStyle: { width: 2, type: 'dashed', color, opacity },
              itemStyle: { color, opacity }
            });
          }
        });
      }
    }

    return {
      tooltip: { trigger:'item', appendToBody: true, padding: [6, 10], backgroundColor:'rgba(255,255,255,0.95)', borderColor:'#A8D8B9', textStyle:{color:'#333333',fontSize: 10,fontFamily:'"Outfit","Inter",sans-serif'}, extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 6px;' },
      legend: { 
        show: true, 
        top: viewMode === 'radar' ? '86%' : (isVertical ? '80%' : '75%'), 
        icon: 'circle', 
        itemWidth: (viewMode === 'radar' || isVertical) ? 6 : 10,
        itemHeight: (viewMode === 'radar' || isVertical) ? 6 : 10,
        itemGap: (viewMode === 'radar' || isVertical) ? 8 : 10,
        textStyle: { fontSize: (viewMode === 'radar' || isVertical) ? 10 : 12, fontFamily: '"Outfit","Inter",sans-serif', color: '#555' } 
      },
      radar: {
        center: viewMode === 'radar' ? ['50%', '48%'] : (isVertical ? ['50%', '42%'] : ['50%','46%']), 
        radius: viewMode === 'radar' ? '52%' : (isVertical ? '45%' : '60%'),
        indicator: indicatorNames.map(n => ({ name: i18n[n] || n, max: featureMaxes?.[n] ? Math.max(featureMaxes[n] * 1.25, 0.9) : 1 })),
        splitNumber: 4,
        axisName:  { color:'#555555', fontWeight:'bold', fontSize: (viewMode === 'radar' || isVertical) ? 9 : 11, borderRadius:3, padding:[2,4], backgroundColor:'rgba(255,255,255,0.85)' },
        splitArea: { areaStyle:{ color:['rgba(250,250,250,0.3)','rgba(240,240,240,0.5)','rgba(230,230,230,0.8)','rgba(168,216,185,0.2)'] } },
        axisLine:  { lineStyle:{ color:'#DDDDDD' } },
        splitLine: { lineStyle:{ color:'#DDDDDD' } }
      },
      series: [{
        name:'流派声学特征', type:'radar',
        symbol: 'circle',
        symbolSize: (viewMode === 'radar' || isVertical) ? 4 : 6,
        data: radarSeriesData
      }]
    };
  }, [radarFeatures, indicatorNames, featureMaxes, hoveredCategory, graphData]);

  const chordEvents = {
    click:     p => { 
      if (selectedSongRef.current) return; // 歌曲选中时冻结点击切换（使用 ref 指针完美破解 ECharts 事件绑定闭包陷阱）
      if (p.seriesType === 'sunburst' && p.data?.features) onNodeClick(p.data); 
    },
    mouseover: p => { 
      if (selectedSongRef.current) return; // 歌曲选中时彻底冰冻悬停，划入时不影响状态（使用 ref 实时最新判断）
      if (p.seriesType === 'sunburst') { 
        if (p.data?.features) onNodeHover(p.data); 
        setHoveredCategory(p.name); 
      } 
    },
    mouseout:  p => { 
      if (selectedSongRef.current) return; // 歌曲选中时彻底冰冻，划出时绝不重置清空状态
      if (p.seriesType === 'sunburst') setHoveredCategory(null); 
    }
  };

  return (
    <div 
      className="chart-container" 
      style={{ 
        display:'flex', 
        flexDirection: (viewMode === 'both' && isVertical) ? 'column' : 'row',
        height: viewMode === 'both' ? (isVertical ? '100%' : '800px') : '100%', 
        width:'100%', 
        position: 'relative', 
        overflow: 'hidden',
        borderRadius: viewMode === 'both' ? '16px' : '0px',
        background: viewMode === 'both' ? '#FFFFFF' : 'transparent',
        transition: 'all 0.5s ease-in-out'
      }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes eq-bounce-1 {
          0% { height: 6px; }
          100% { height: 26px; }
        }
        @keyframes eq-bounce-2 {
          0% { height: 12px; }
          100% { height: 32px; }
        }
        @keyframes eq-bounce-3 {
          0% { height: 4px; }
          100% { height: 20px; }
        }
        @keyframes eq-bounce-4 {
          0% { height: 14px; }
          100% { height: 28px; }
        }
        @keyframes eq-bounce-5 {
          0% { height: 8px; }
          100% { height: 24px; }
        }
      `}</style>

      {/* 1. 底层专辑封面大背景（零模糊高清呈现） - 暂时隐藏 */}
      {false && viewMode !== 'sunburst' && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: coverUrl ? `url(${coverUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: coverUrl ? 0.38 : 0, // 显著调高不透明度，细节一览无余
            transition: 'background-image 0.6s ease-in-out, opacity 0.6s ease-in-out',
            zIndex: 0,
            pointerEvents: 'none'
          }}
        />
      )}
 
      {/* 2. 极薄亮色调和层（暂时隐藏） */}
      {false && viewMode !== 'sunburst' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.42) 100%)',
            opacity: coverUrl ? 1 : 0,
            transition: 'opacity 0.6s ease-in-out',
            zIndex: 0,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* 主体图表区域，置于背景层之上，内部包含两个浮动的羊脂白玉卡片保护图表可读性 */}
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: (viewMode === 'both' && isVertical) ? 'column' : 'row',
          height: '100%', 
          width: '100%', 
          zIndex: 1, 
          position: 'relative',
          padding: viewMode !== 'both' ? '0px' : (isVertical ? '10px 10px' : '30px 10px'),
          boxSizing: 'border-box'
        }}
      >
        {/* Left Card: Sunburst + Chord Ribbons */}
        {(viewMode === 'both' || viewMode === 'sunburst') && (
          <div 
            style={{ 
              flex: viewMode === 'sunburst' ? '1 1 100%' : (isVertical ? '0 0 50%' : '0 0 60%'), 
              height: viewMode === 'sunburst' ? '100%' : (isVertical ? '50%' : '100%'), 
              padding: viewMode === 'sunburst' ? '0px' : (isVertical ? '10px 20px' : '0 20px 0 30px'), 
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 0
            }}
          >
            <div
              style={{
                height: '100%', 
                width: '100%',
                background: viewMode === 'sunburst' ? 'transparent' : (coverUrl ? 'rgba(255, 255, 255, 0.88)' : '#FFFFFF'),
                backdropFilter: viewMode === 'sunburst' ? 'none' : (coverUrl ? 'blur(16px)' : 'none'),
                WebkitBackdropFilter: viewMode === 'sunburst' ? 'none' : (coverUrl ? 'blur(16px)' : 'none'),
                borderRadius: viewMode === 'sunburst' ? '0px' : '24px',
                border: viewMode === 'sunburst' ? 'none' : (coverUrl ? '1px solid rgba(255, 255, 255, 0.7)' : '1px solid rgba(0,0,0,0.03)'),
                boxShadow: viewMode === 'sunburst' ? 'none' : (coverUrl ? '0 12px 36px rgba(0, 0, 0, 0.05)' : 'none'),
                transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box'
              }}
            >
              <ReactECharts
                ref={echartsRef}
                key="chord-sunburst"
                option={chordOptions}
                style={{ height:'100%', width:'100%' }}
                onEvents={chordEvents}
              />
            </div>
          </div>
        )}

        {/* Right Card: Radar */}
        {(viewMode === 'both' || viewMode === 'radar') && (
          <div 
            style={{ 
              flex: viewMode === 'radar' ? '1 1 100%' : (isVertical ? '0 0 50%' : '0 0 40%'), 
              height: viewMode === 'radar' ? '100%' : (isVertical ? '50%' : '100%'), 
              padding: viewMode === 'radar' ? '0px' : (isVertical ? '10px 20px' : '0 30px 0 20px'), 
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 0
            }}
          >
            <div
              style={{
                height: '100%', 
                width: '100%', 
                background: viewMode === 'radar' ? 'transparent' : (coverUrl ? 'rgba(255, 255, 255, 0.88)' : '#FFFFFF'),
                backdropFilter: viewMode === 'radar' ? 'none' : (coverUrl ? 'blur(16px)' : 'none'),
                WebkitBackdropFilter: viewMode === 'radar' ? 'none' : (coverUrl ? 'blur(16px)' : 'none'),
                borderRadius: viewMode === 'radar' ? '0px' : '24px',
                border: viewMode === 'radar' ? 'none' : (coverUrl ? '1px solid rgba(255, 255, 255, 0.7)' : '1px solid rgba(0,0,0,0.03)'),
                boxShadow: viewMode === 'radar' ? 'none' : (coverUrl ? '0 12px 36px rgba(0, 0, 0, 0.05)' : 'none'),
                transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: viewMode === 'radar' ? '0px' : (isVertical ? '8px 16px' : '16px'),
                boxSizing: 'border-box'
              }}
            >
              {radarFeatures ? (
                <ReactECharts option={radarOptions} style={{ height:'100%', width:'100%' }} />
              ) : (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#AAAAAA', fontSize:'14px', flexDirection:'column', gap:'12px' }}>
                  <div style={{ fontSize:'48px', opacity:0.3 }}>🎵</div>
                  <span>悬停旭日图节点，查看流派特征七维 analysis</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 优雅磨砂玻璃悬浮代表歌曲名片 - 大盘模式 */}
      {viewMode === 'both' && repSong && coverUrl && (
        <div 
          style={{
            position: 'absolute',
            bottom: isVertical ? '8px' : '24px',
            right: isVertical ? '8px' : '24px', 
            display: 'flex',
            alignItems: 'center',
            gap: isVertical ? '8px' : '16px',
            padding: isVertical ? '6px 12px' : '12px 18px',
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(20px) saturate(120%)',
            WebkitBackdropFilter: 'blur(20px) saturate(120%)',
            border: '1px solid rgba(255, 255, 255, 0.45)',
            borderRadius: isVertical ? '12px' : '16px',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.08)',
            maxWidth: isVertical ? '220px' : '320px',
            transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            opacity: coverUrl ? 1 : 0,
            transform: coverUrl ? 'translateY(0) scale(1)' : 'translateY(15px) scale(0.95)',
            zIndex: 10,
            pointerEvents: 'none' // Avoid obstructing mouse hover events on ECharts
          }}
        >
          {/* 旋转黑胶唱片外观 */}
          <div style={{ position: 'relative', width: isVertical ? '36px' : '56px', height: isVertical ? '36px' : '56px', flexShrink: 0 }}>
            <img 
              src={coverUrl} 
              alt="Album Cover" 
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid rgba(255, 255, 255, 0.8)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                animation: 'spin 12s linear infinite'
              }}
            />
            <div 
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#FFFFFF',
                border: '1px solid rgba(0,0,0,0.1)'
              }}
            />
          </div>

          {/* 歌曲详情 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#88B04B', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                🔥 流派代表作
              </div>
              {/* 微缩跳动频谱波形 */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-end', 
                  gap: '2px', 
                  height: '10px', 
                  paddingBottom: '1px'
                }}
              >
                <div style={{ width: '2px', background: '#88B04B', borderRadius: '1px', height: '4px', animation: 'eq-bounce-1 0.8s ease-in-out infinite alternate' }} />
                <div style={{ width: '2px', background: '#88B04B', borderRadius: '1px', height: '8px', animation: 'eq-bounce-2 0.5s ease-in-out infinite alternate' }} />
                <div style={{ width: '2px', background: '#88B04B', borderRadius: '1px', height: '3px', animation: 'eq-bounce-3 0.7s ease-in-out infinite alternate' }} />
                <div style={{ width: '2px', background: '#88B04B', borderRadius: '1px', height: '6px', animation: 'eq-bounce-4 0.6s ease-in-out infinite alternate' }} />
              </div>
            </div>

            <div 
              style={{ 
                fontSize: '13px', 
                fontWeight: '700', 
                color: '#222222', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis',
                fontFamily: '"Outfit", "Inter", sans-serif'
              }}
            >
              {repSong.title}
            </div>
            <div 
              style={{ 
                fontSize: '11px', 
                color: '#555555', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis',
                fontFamily: '"Outfit", "Inter", sans-serif'
              }}
            >
              {repSong.artist}
            </div>
            {/* 流行度进度条 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <div style={{ width: '80px', height: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${repSong.popularity}%`, height: '100%', background: 'linear-gradient(90deg, #A8D8B9, #88B04B)', borderRadius: '2px' }} />
              </div>
              <span style={{ fontSize: '9px', color: '#777777', fontWeight: '600' }}>Pop: {Math.round(repSong.popularity)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* 优雅磨砂玻璃悬浮代表歌曲名片 - 极微小药丸模式（只在雷达图卡片右上角显示，绝对不挡字） */}
      {viewMode === 'radar' && repSong && coverUrl && (
        <div 
          style={{
            position: 'absolute',
            top: '8px',
            right: '12px', 
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 8px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.65)',
            boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.05)',
            maxWidth: '150px',
            transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            opacity: coverUrl ? 1 : 0,
            transform: coverUrl ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.95)',
            zIndex: 10,
            pointerEvents: 'none', // 确保绝不遮挡下层雷达图及驾驶舱任何组件的Hover/Click事件
            overflow: 'hidden' // 确保背景底图完美截断在圆角内
          }}
        >
          {/* Layer 0: 专辑封面底图磨砂质感背景层 */}
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: coverUrl ? `url(${coverUrl})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(10px) saturate(110%)',
              opacity: 0.15,
              zIndex: 0
            }}
          />
          
          {/* Layer 1: Frosted Glass 微白半透明融合调和层 */}
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(255, 255, 255, 0.65)',
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)',
              zIndex: 1
            }}
          />

          {/* Layer 2: 前景内容层 (必须配置 position: relative 和 zIndex: 2 以完美浮现于背景层之上) */}
          {/* 旋转小唱片 */}
          <div style={{ position: 'relative', width: '16px', height: '16px', flexShrink: 0, zIndex: 2 }}>
            <img 
              src={coverUrl} 
              alt="Album Cover" 
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1px solid rgba(255, 255, 255, 0.8)',
                animation: 'spin 12s linear infinite'
              }}
            />
            <div 
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: '#FFFFFF'
              }}
            />
          </div>
          {/* 迷你代表歌曲名 */}
          <div 
            style={{ 
              position: 'relative',
              zIndex: 2,
              fontSize: '8.5px', 
              fontWeight: '700', 
              color: '#333333', 
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              fontFamily: '"Outfit", "Inter", sans-serif'
            }}
          >
            🎵 {repSong.title}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToggleableChordRadar;
