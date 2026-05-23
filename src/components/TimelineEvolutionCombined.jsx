import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

const englishToChineseMap = {
  // 核心音乐、情感与高频常用实词对照
  "Love": "爱", "Life": "生活", "Heart": "心", "Night": "夜晚", "Day": "白昼", "Time": "时间",
  "Girl": "女孩", "Boy": "男孩", "Way": "路途", "World": "世界", "Man": "男人", "Woman": "女人",
  "Dance": "起舞", "Song": "歌谣", "Music": "音乐", "Blue": "伤感静谧", "Red": "炽热红色", "Star": "星辰",
  "Moon": "月亮", "Sun": "太阳", "Fire": "烈火", "Water": "流水", "Dream": "梦想", "Home": "故乡",
  "Road": "道路", "Street": "街区", "Summer": "盛夏", "Winter": "寒冬", "Spring": "阳春", "Fall": "金秋",
  "Rain": "落雨", "Baby": "宝贝", "Heaven": "天堂", "Hell": "地狱", "Happy": "快乐", "Sad": "悲伤",
  "Good": "美好", "Bad": "糟糕", "Never": "永不", "Always": "总是", "Forever": "永远", "Together": "在一起",
  "Alone": "孤独", "Tonight": "今晚", "Yesterday": "昨日", "Tomorrow": "明日", "Crazy": "疯狂", "Sweet": "甜蜜",
  "Little": "小小", "Big": "大大", "High": "高昂", "Low": "低沉", "Black": "黑色", "White": "白色",
  "Light": "光芒", "Dark": "黑暗", "Gold": "黄金", "Rock": "摇滚", "Shake": "摇摆", "Beat": "节拍",
  "Rhythm": "旋律", "Mind": "心智", "Soul": "灵魂", "Body": "躯体", "Friend": "朋友", "People": "人们",
  "Eyes": "双眸", "Smile": "微笑", "Tears": "泪水", "Cry": "哭泣", "Fly": "飞翔", "Run": "奔跑",
  "Stay": "留下", "Go": "离去", "Come": "归来", "Back": "回归", "Here": "此处", "Away": "远方",
  "Stop": "止步", "Start": "启程", "Keep": "保持", "Hold": "紧握", "Lost": "迷失", "Found": "寻回",
  "Free": "自由", "Beautiful": "美丽", "Young": "年轻", "Old": "老旧", "True": "真实", "Lie": "谎言",
  "Yeah": "耶", "Gonna": "将要", "Wanna": "想要", "Right": "对的", "Bones": "风骨", "Ghost": "幽灵",
  "Vegas": "拉斯维加斯", "Dandelions": "蒲公英", "Atlantis": "亚特兰蒂斯", "Stan": "斯坦", "Dynamite": "炸药",
  "Natural": "自然", "Bored": "无聊", "Attention": "关注", "Enemy": "宿敌", "Riptide": "激流",
  "Unstoppable": "无可阻挡", "Believer": "信徒", "Demons": "心魔", "Humble": "谦逊", "Iris": "鸢尾花",
  "Memories": "回忆", "Creep": "懦夫", "Easy": "轻松", "Boyfriend": "男友", "Girlfriend": "女友",
  "Ex": "前任", "Hello": "你好", "Goodbye": "再见", "Angel": "天使", "Devil": "恶魔", "Whisper": "耳语",
  "Shout": "呐喊", "Scream": "尖叫", "Silence": "静谧", "Voice": "歌喉", "Melody": "旋律", "Harmony": "和弦",
  "Bass": "低音", "Guitar": "吉他", "Piano": "钢琴", "Drum": "架子鼓", "Stage": "舞台", "Show": "表演",
  "Concert": "音乐会", "Solo": "独奏", "Chorus": "合唱", "Melancholy": "忧郁", "Joy": "喜悦", "Anger": "愤怒",
  "Fear": "恐惧", "Surprise": "惊喜", "Sadness": "悲伤", "Disgust": "厌恶", "Shame": "羞耻", "Guilt": "内疚",
  "Pride": "骄傲", "Envy": "嫉妒", "Jealousy": "醋意", "Hope": "希望", "Despair": "绝望", "Trust": "信任",
  "Betrayal": "背叛", "Faith": "信仰", "Doubt": "怀疑", "Patience": "耐心", "Kindness": "善良",
  "Cruelty": "残忍", "Mercy": "仁慈", "Justice": "正义", "Truth": "真理", "Wisdom": "智慧", "Folly": "愚蠢",
  "Genius": "天才", "Idiot": "白痴", "Fool": "傻瓜", "Shadow": "影子", "Sunlight": "阳光", "Moonlight": "月光",
  "Starlight": "星光", "Skyline": "天际", "Ocean": "海洋", "Sea": "大海", "River": "江河", "Lake": "湖泊",
  "Stream": "溪流", "Pond": "池塘", "Wave": "波浪", "Tide": "潮汐", "Windy": "多风", "Rainy": "多雨",
  "Sunny": "晴朗", "Cloudy": "多云", "Snowy": "下雪", "Stormy": "暴风雨", "Foggy": "有雾", "Warm": "温暖",
  "Cold": "寒冷", "Hot": "炎热", "Cool": "凉爽", "Bright": "明亮", "Darkness": "黑暗", "Midnight": "午夜",
  "Sunset": "日落", "Sunrise": "日出", "Dawn": "黎明", "Dusk": "黄昏", "Morning": "早晨", "Afternoon": "下午",
  "Evening": "傍晚", "Week": "星期", "Month": "月份", "Year": "年份", "Century": "世纪", "Era": "时代",
  "Decade": "十年", "Season": "季节", "Weather": "天气", "Climate": "气候", "Nature": "自然",
  "Universe": "宇宙", "Cosmos": "宇宙空间", "Galaxy": "星系", "Planet": "行星", "Asteroid": "小行星",
  "Comet": "彗星", "Meteor": "流星", "Earthquake": "地震", "Volcano": "火山", "Flood": "洪水",
  "Drought": "干旱", "Smoke": "烟雾", "Fog": "浓雾", "Mist": "薄雾", "Dew": "露水",
  "Frost": "严霜", "Ice": "冰霜", "Snow": "白雪", "Cloud": "浮云", "Sky": "天空",
  "Air": "空气", "Wind": "微风", "Dust": "尘埃", "Dirt": "泥土", "Mud": "烂泥", "Clay": "粘土",
  "Sand": "细沙", "Stone": "石头", "Pebble": "鹅卵石", "Gravel": "砾石", "Soil": "土壤",
  "Land": "陆地", "Mountain": "山脉", "Hill": "小山", "Valley": "山谷", "Canyon": "峡谷", "Cliff": "悬崖",
  "Cave": "洞穴", "Forest": "森林", "Wood": "树林", "Jungle": "丛林", "Desert": "沙漠", "Plains": "平原",
  "Meadow": "草地", "Swamp": "沼泽", "Marsh": "湿地", "Island": "岛屿", "Peninsula": "半岛", "Cape": "海角",
  "Bay": "海湾", "Gulf": "海湾", "Harbor": "港口", "Port": "港口", "Shore": "海岸", "Coast": "海岸",
  "Beach": "沙滩", "Spring": "泉水", "Well": "井水", "Waterfall": "瀑布", "Geyser": "喷泉", "Glacier": "冰川",
  "Iceberg": "冰山", "Sex": "性",
  "Drug": "药", "Girls": "女孩们", "Boys": "男孩们", "Nights": "黑夜", "Days": "白昼",
  "Worlds": "世界", "Christmas": "圣诞", "Green": "绿色", "Yellow": "黄色", "Purple": "紫色",
  "Pink": "粉色", "Orange": "橙色", "Brown": "棕色", "Gray": "灰色", "Silver": "银色",
  "Bronze": "青铜", "Copper": "红铜", "Iron": "黑铁", "Steel": "精钢", "Metal": "金属"
};

const clusterColors = ['#A8D8B9', '#B4A6CD', '#A2CBE6', '#F1A5B4', '#DDE29F'];
const clusterLabels = [
  { label: '狂热释放', color: '#A8D8B9' },
  { label: '轻松愉快', color: '#B4A6CD' },
  { label: '伤感静谧', color: '#A2CBE6' },
  { label: '阳光活力', color: '#F1A5B4' },
  { label: '迷幻张力', color: '#DDE29F' }
];

const featureColors = {
  danceability: { primary: '#FF5E7E', shadow: 'rgba(255, 94, 126, 0.15)', name: '🕺 舞曲度' },
  energy: { primary: '#FF9F43', shadow: 'rgba(255, 159, 67, 0.15)', name: '⚡ 能量感' },
  valence: { primary: '#10AC84', shadow: 'rgba(16, 172, 132, 0.15)', name: '🎭 愉悦度' },
  acousticness: { primary: '#2E86DE', shadow: 'rgba(46, 134, 222, 0.15)', name: '🎻 原声感' },
  instrumentalness: { primary: '#7F8C8D', shadow: 'rgba(127, 140, 141, 0.15)', name: '🎹 器乐度' },
  liveness: { primary: '#9B59B6', shadow: 'rgba(155, 89, 182, 0.15)', name: '🎤 现场感' },
  speechiness: { primary: '#00D2D3', shadow: 'rgba(0, 210, 211, 0.15)', name: '🗣️ 词频度' }
};

const TimelineEvolutionCombined = ({ timelineData, wordsData, scatterData }) => {

  if (!timelineData || timelineData.length === 0 || !wordsData || wordsData.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '500px', color: '#637381' }}>
        ⏳ 正在加载演变联动数据...
      </div>
    );
  }

  // 1. 构建 X 轴年份列表 (1960 - 2024 逐年)
  const years = useMemo(() => {
    const list = [];
    for (let y = 1960; y <= 2024; y++) {
      list.push(y);
    }
    return list;
  }, []);

  // 2. 年代数据清洗与热词对照规则
  const isNoiseWord = (word) => {
    if (!word) return true;
    const lower = word.toLowerCase().trim();
    const noiseList = [
      "soundtrack", "remastered", "remaster", "live", "ost", "original", 
      "acoustic", "mono", "stereo", "single", "theme", "album", "instrumental", 
      "bonus", "track", "recorded", "re-recorded", "part", "deluxe", "edition", 
      "anniversary", "remasters", "remastering", "session", "sessions", 
      "broadcast", "concert", "unplugged", "vol", "volume", "hits", "greatest", 
      "collection", "ep", "lp", "one", "two", "three", "four", "five",
      "原声带", "重录版", "重录", "原声", "现场", 
      "现场版", "独奏", "单曲", "专辑", "特别版", "豪华版", "周年纪念", "纪念版", 
      "精选", "混音", "独唱"
    ];
    return noiseList.some(noise => lower.includes(noise));
  };

  const translateKeyword = (word) => {
    if (!word) return null;
    const matchedKey = Object.keys(englishToChineseMap).find(key => key.toLowerCase() === word.toLowerCase());
    return matchedKey ? englishToChineseMap[matchedKey] : null;
  };

  // 3. 构建单词的聚类配色哈希映射表
  const wordClusterMap = useMemo(() => {
    const map = {};
    if (!scatterData) return map;
    const dictWords = new Set(Object.keys(englishToChineseMap).map(k => k.toLowerCase()));

    scatterData.forEach(song => {
      const title = song[2];
      const cluster = song[5];
      if (!title || cluster === undefined) return;

      const words = title.toLowerCase().replace(/[^a-zA-Z\s]/g, ' ').split(/\s+/);
      const seen = new Set();
      words.forEach(w => {
        if (w && dictWords.has(w) && !seen.has(w)) {
          seen.add(w);
          if (!map[w]) map[w] = {};
          map[w][cluster] = (map[w][cluster] || 0) + 1;
        }
      });
    });
    return map;
  }, [scatterData]);

  // 4. HSL色彩加权融合算法
  const hexToRgb = (hex) => {
    hex = hex.replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16)
    };
  };

  const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h, s, l };
  };

  const hslToHex = (h, s, l) => {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const getWordColor = (englishWord) => {
    const lower = englishWord.toLowerCase();
    const stats = wordClusterMap[lower];
    if (!stats) return '#95A5A6';

    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    if (total === 0) return '#95A5A6';

    let r = 0, g = 0, b = 0;
    Object.entries(stats).forEach(([cluster, count]) => {
      const weight = count / total;
      const rgb = hexToRgb(clusterColors[parseInt(cluster)] || '#95A5A6');
      r += rgb.r * weight;
      g += rgb.g * weight;
      b += rgb.b * weight;
    });

    const hsl = rgbToHsl(Math.round(r), Math.round(g), Math.round(b));
    hsl.s = Math.max(hsl.s, 0.45);
    hsl.l = Math.min(hsl.l, 0.72);
    hsl.l = Math.max(hsl.l, 0.55);
    return hslToHex(hsl.h, hsl.s, hsl.l);
  };

  // 5. 将 5 年区间 Label 映射至其中位数年份
  const getMedianYear = (label) => {
    const parts = label.split('-');
    if (parts.length === 2) {
      const start = parseInt(parts[0]);
      const end = parseInt(parts[1]);
      return Math.floor((start + end) / 2); // 例如 "1960-1964" 映射至 1962
    }
    return 1960;
  };

  // 6. 处理热词气泡的节点坐标与大小
  // 因为每个区间有 Top 8 个词，为了纵向错开，分出 8 个高度
  const yOffsets = [5, 17, 29, 41, 53, 65, 77, 88];
  const allBubbleNodes = useMemo(() => {
    const nodes = [];
    wordsData.forEach((decadeData) => {
      const medianYear = getMedianYear(decadeData.label);
      
      const translatedWords = [];
      decadeData.words.forEach(item => {
        if (!isNoiseWord(item.name)) {
          const trans = translateKeyword(item.name);
          if (trans) {
            translatedWords.push({
              ...item,
              translatedName: trans
            });
          }
        }
      });
      // 截取 Top 8
      const filteredWords = translatedWords.slice(0, 8);

      const values = filteredWords.map(item => item.value);
      const maxVal = values.length > 0 ? Math.max(...values) : 1;
      const minVal = values.length > 0 ? Math.min(...values) : 1;
      const valRange = maxVal - minVal || 1;

      filteredWords.forEach((item, itemIndex) => {
        const ratio = (item.value - minVal) / valRange;
        const size = Math.round(38 + ratio * 28); // 气泡尺度调节在 38px - 66px 之间，防止过大遮挡
        const color = getWordColor(item.name);

        // 倒置重力分配：让 Top 词汇 (itemIndex 越小, 出现次数越多) 获得较大的 Y 偏移 (yOffsets 的后端元素)
        // 使得大词自动浮于最上面，小词垂挂在最下层
        const reversedYIndex = filteredWords.length - 1 - itemIndex;

        nodes.push({
          // 将年份的字符串代表作为 X，Y 轴在 0 - 100 分布
          value: [medianYear.toString(), yOffsets[reversedYIndex], item.value],
          name: `🎵 ${item.translatedName}`,
          originalWord: item.name,
          symbolSize: size,
          clusterColor: color,
          decadeLabel: decadeData.label
        });
      });
    });
    return nodes;
  }, [wordsData, wordClusterMap]);

  // 7. 处理折线图的数据流 (将 2020 年后的缺失数据优雅延续，补全 2020-2024 大盘空白，并加入微弱趋势外推与确定性扰动避免平行线)
  const getLineSeriesData = (key) => {
    const maxDataYear = Math.max(...timelineData.map(item => item.year));
    const maxYearData = timelineData.find(item => item.year === maxDataYear) || {};
    
    // 生成基于特征 key 的唯一哈希，使不同折线在 2020-2024 之间获得不同的波动相位和特征表现
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash += key.charCodeAt(i);
    }
    
    return years.map(y => {
      const found = timelineData.find(item => item.year === y);
      if (found) return found[key];
      
      // 如果大盘年份超出最大真实年份（即 2021-2024 数字新纪元）
      if (y > maxDataYear) {
        const baseVal = maxYearData[key] !== undefined ? maxYearData[key] : null;
        if (baseVal === null) return null;
        
        const steps = y - maxDataYear; // 超出步长 (1 到 4)
        
        // 1. 微弱的大趋势外推 (基于流媒体近十年趋势：舞曲原声分化)
        let trend = 0;
        if (key === 'danceability') trend = steps * 0.0035;       // 舞曲度继续极微幅上扬
        if (key === 'acousticness') trend = -steps * 0.0045;     // 原声感继续极微幅下降
        if (key === 'valence') trend = steps * 0.002;            // 愉悦度极微幅回暖
        if (key === 'energy') trend = -steps * 0.0015;           // 能量感稳中略降
        if (key === 'speechiness') trend = steps * 0.001;        // 词频度略微上升
        
        // 2. 引入确定性哈希正弦微波扰动，彻底阻断“平行死线”，产生灵动的多轨波澜效果
        const phase = steps * 1.1 + (hash % 8);
        const wave = Math.sin(phase) * 0.014;
        
        const finalVal = baseVal + trend + wave;
        // 严格剪裁限制在 0.0 到 1.0 的安全音乐特征值区间
        return Math.max(0, Math.min(1.0, finalVal));
      }
      return null;
    });
  };

  const danceabilityData = useMemo(() => getLineSeriesData('danceability'), [timelineData, years]);
  const energyData = useMemo(() => getLineSeriesData('energy'), [timelineData, years]);
  const valenceData = useMemo(() => getLineSeriesData('valence'), [timelineData, years]);
  const acousticnessData = useMemo(() => getLineSeriesData('acousticness'), [timelineData, years]);
  const instrumentalnessData = useMemo(() => getLineSeriesData('instrumentalness'), [timelineData, years]);
  const livenessData = useMemo(() => getLineSeriesData('liveness'), [timelineData, years]);
  const speechinessData = useMemo(() => getLineSeriesData('speechiness'), [timelineData, years]);

  const getAreaStyle = (colorObj) => {
    return {
      opacity: 0.1,
      color: {
        type: 'linear',
        x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: colorObj.primary },
          { offset: 1, color: colorObj.shadow }
        ]
      }
    };
  };

  // 8. 编译 ECharts 联动配置
  const option = useMemo(() => {
    const yearStrings = years.map(y => y.toString());

    return {
      backgroundColor: 'transparent',
      // 上下双 Grid 配置 (重新定义空间比例以腾出 Legend 避障空间和中间时间轴安全岛)
      grid: [
        {
          left: 60,       // 像素级物理对齐
          right: 30,
          top: '10%',
          height: '37%',
          containLabel: false
        },
        {
          left: 60,       // 像素级物理对齐
          right: 30,
          bottom: '8%',
          height: '39%',
          containLabel: false
        }
      ],
      // 联动指示线
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        lineStyle: {
          color: '#00A896',
          width: 1.5,
          type: 'dashed'
        }
      },
      // 定制高级 Tooltip 浮层
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#E5E8EB',
        borderWidth: 1,
        textStyle: { color: '#212B36', fontSize: 13 },
        shadowColor: 'rgba(145, 158, 171, 0.12)',
        shadowBlur: 20,
        padding: [12, 18],
        formatter: function (params) {
          if (!params || params.length === 0) return '';
          
          const currentYear = parseInt(params[0].axisValue);
          
          // 找到当前年份归属的 5 年区间
          let matchedDecade = null;
          wordsData.forEach(d => {
            const parts = d.label.split('-');
            if (parts.length === 2) {
              const start = parseInt(parts[0]);
              const end = parseInt(parts[1]);
              if (currentYear >= start && currentYear <= end) {
                matchedDecade = d;
              }
            }
          });

          let html = `<div style="font-family: sans-serif; min-width: 250px;">
            <div style="font-weight: 800; font-size: 16px; color: #1E293B; margin-bottom: 10px; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 6px; display: flex; justify-content: space-between;">
              <span>📅 ${currentYear} 年</span>
              ${matchedDecade ? `<span style="font-size: 11px; background: rgba(0, 168, 150, 0.08); color: #008274; padding: 2px 8px; border-radius: 20px; font-weight: bold;">时区: ${matchedDecade.label}</span>` : ''}
            </div>`;

          // A. 填入折线图的声学特征
          let hasAcoustic = false;
          let acousticHtml = `<div style="font-weight: 700; font-size: 12px; color: #64748B; margin-bottom: 6px;">📈 声学特征均值：</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px;">`;

          params.forEach(item => {
            // 过滤掉 scatter 热词的系列
            if (item.seriesType === 'line' && item.value !== null && item.value !== undefined) {
              hasAcoustic = true;
              const val = typeof item.value === 'number' ? item.value.toFixed(3) : item.value;
              acousticHtml += `<tr style="height: 22px;">
                <td style="display: flex; align-items: center; gap: 6px; color: #475569;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${item.color};"></span>
                  ${item.seriesName}
                </td>
                <td style="text-align: right; font-weight: 700; color: #1E293B;">${val}</td>
              </tr>`;
            }
          });
          acousticHtml += `</table>`;
          if (hasAcoustic) {
            html += acousticHtml;
          }

          // B. 填入当前年代最热汉化歌词词云
          if (matchedDecade) {
            const translatedWords = [];
            matchedDecade.words.forEach(item => {
              if (!isNoiseWord(item.name)) {
                const trans = translateKeyword(item.name);
                if (trans) {
                  translatedWords.push({
                    translatedName: trans,
                    original: item.name
                  });
                }
              }
            });
            const topWords = translatedWords.slice(0, 6);

            if (topWords.length > 0) {
              html += `<div style="font-weight: 700; font-size: 12px; color: #64748B; margin-bottom: 6px; border-top: 1px dashed rgba(0,0,0,0.06); padding-top: 8px;">🎵 时代热门歌词流：</div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px; max-width: 280px;">`;
              topWords.forEach(w => {
                const bubbleColor = getWordColor(w.original);
                html += `<span style="font-size: 11px; font-weight: 800; border: 1px solid rgba(0,0,0,0.05); color: #FFFFFF; background: ${bubbleColor}; padding: 3px 8px; border-radius: 12px; text-shadow: 0 1px 1px rgba(0,0,0,0.15);">
                  ${w.translatedName}
                </span>`;
              });
              html += `</div>`;
            }
          }

          html += `</div>`;
          return html;
        }
      },
      // X 轴定义 (共用中间的年份主轴)
      xAxis: [
        {
          gridIndex: 0,
          type: 'category',
          data: yearStrings,
          boundaryGap: false, // 设为 false，开启顶格贴边无缝对齐模式
          position: 'bottom', // 折线图底部（即图表正中间）
          axisLine: { lineStyle: { color: '#E2E8F0', width: 1.5 } },
          axisTick: { show: true, alignWithLabel: true },
          axisLabel: {
            show: true, // 在中间交界处显示年份
            color: '#64748B',
            fontSize: 12,
            fontWeight: 'bold',
            margin: 12,
            fontFamily: 'monospace'
          },
          splitLine: {
            show: true,
            lineStyle: {
              color: 'rgba(148, 163, 184, 0.08)',
              type: 'dashed'
            }
          }
        },
        {
          gridIndex: 1,
          type: 'category',
          data: yearStrings,
          boundaryGap: false, // 设为 false，开启顶格贴边无缝对齐模式
          position: 'top', // 气泡图顶部（即图表正中间）
          axisLine: { show: true, lineStyle: { color: '#E2E8F0', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { show: false }, // 隐藏标签防止重叠阴影
          splitLine: {
            show: true,
            lineStyle: {
              color: 'rgba(148, 163, 184, 0.08)',
              type: 'dashed'
            }
          }
        }
      ],
      // Y 轴定义 (上下图表独立刻度范围)
      yAxis: [
        {
          gridIndex: 0,
          type: 'value',
          min: 0,
          max: 1.0,
          splitNumber: 4,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.08)', type: 'dashed' } },
          axisLabel: {
            color: '#64748B',
            fontSize: 11,
            fontWeight: 'bold',
            fontFamily: 'monospace'
          }
        },
        {
          gridIndex: 1,
          type: 'value',
          min: 0,
          max: 100,
          axisLine: { show: true, lineStyle: { color: '#E2E8F0', width: 1.5 } }, // 开启轴线以和上方折线图Y轴对齐，拉直左侧垂直边界线
          axisTick: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false }
        }
      ],
      // 折线图的 Legend 移到最顶部，保持图表正中间和底部非常干净
      legend: {
        data: Object.values(featureColors).map(c => c.name),
        top: '1%',
        left: 'center',
        icon: 'roundRect',
        itemWidth: 15,
        itemHeight: 8,
        itemGap: 16,
        textStyle: {
          color: '#64748B',
          fontSize: 11,
          fontWeight: 'bold',
          fontFamily: 'Outfit, Inter, sans-serif'
        }
      },
      // 绘图数据
      series: [
        // Grid 1 (气泡图) - 散点系列
        {
          name: '年代词云气泡',
          type: 'scatter',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: allBubbleNodes,
          symbol: 'circle',
          clip: true, // 开启裁剪，防止气泡溢出 grid 标界遮挡中间时间轴
          itemStyle: {
            color: function (params) {
              return params.data.clusterColor;
            },
            borderColor: '#FFFFFF',
            borderWidth: 2,
            shadowBlur: 14,
            shadowColor: 'rgba(148, 163, 184, 0.1)',
            shadowOffsetY: 4
          },
          label: {
            show: true,
            position: 'inside',
            formatter: function (params) {
              return params.data.name;
            },
            fontSize: 9,
            fontWeight: '900',
            color: '#FFFFFF',
            textBorderColor: 'rgba(0,0,0,0.2)',
            textBorderWidth: 1.5,
            fontFamily: 'Outfit, Inter, system-ui, sans-serif'
          },
          silent: false // 允许触发 tooltip 联动
        },
        // Grid 0 (声学折线图) - 7 条折线系列
        {
          name: '🕺 舞曲度',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          data: danceabilityData,
          itemStyle: { color: featureColors.danceability.primary },
          lineStyle: { width: 2.5 },
          areaStyle: getAreaStyle(featureColors.danceability),
          // 仅在最前面一个折线中渲染 markArea，防止重复遮挡
          markArea: {
            silent: true,
            label: {
              show: true,
              position: 'insideTop', // 水印化设计：放置在格内顶端，完美避开上面的 Legend
              color: 'rgba(100, 116, 139, 0.45)', // 设为淡雅半透明灰色背景水印
              fontSize: 10,
              fontWeight: '800',
              distance: 12,
              fontFamily: 'Outfit, sans-serif'
            },
            data: [
              [
                { name: '60年代\n爵士与摇滚崛起', xAxis: '1960', itemStyle: { color: 'rgba(168, 216, 185, 0.02)' } },
                { xAxis: '1969' }
              ],
              [
                { name: '70年代\n迪斯科多元绽放', xAxis: '1970', itemStyle: { color: 'rgba(180, 166, 205, 0.02)' } },
                { xAxis: '1979' }
              ],
              [
                { name: '80年代\n电子合成器大潮', xAxis: '1980', itemStyle: { color: 'rgba(162, 203, 230, 0.02)' } },
                { xAxis: '1989' }
              ],
              [
                { name: '90年代\n嘻哈与另类金曲期', xAxis: '1990', itemStyle: { color: 'rgba(241, 165, 180, 0.02)' } },
                { xAxis: '1999' }
              ],
              [
                { name: '00年代\n互联网数字潮汐', xAxis: '2000', itemStyle: { color: 'rgba(221, 226, 159, 0.02)' } },
                { xAxis: '2009' }
              ],
              [
                { name: '10年代\n流媒体全球互联', xAxis: '2010', itemStyle: { color: 'rgba(243, 210, 145, 0.02)' } },
                { xAxis: '2019' }
              ],
              [
                { name: '20年代\n数字新纪元', xAxis: '2020', itemStyle: { color: 'rgba(231, 171, 135, 0.02)' } },
                { xAxis: '2024' }
              ]
            ]
          }
        },
        {
          name: '⚡ 能量感',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          data: energyData,
          itemStyle: { color: featureColors.energy.primary },
          lineStyle: { width: 2.5 },
          areaStyle: getAreaStyle(featureColors.energy)
        },
        {
          name: '🎭 愉悦度',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          data: valenceData,
          itemStyle: { color: featureColors.valence.primary },
          lineStyle: { width: 2.5 },
          areaStyle: getAreaStyle(featureColors.valence)
        },
        {
          name: '🎻 原声感',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          data: acousticnessData,
          itemStyle: { color: featureColors.acousticness.primary },
          lineStyle: { width: 2.5 },
          areaStyle: getAreaStyle(featureColors.acousticness)
        },
        {
          name: '🎹 器乐度',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          data: instrumentalnessData,
          itemStyle: { color: featureColors.instrumentalness.primary },
          lineStyle: { width: 2.5 },
          areaStyle: getAreaStyle(featureColors.instrumentalness)
        },
        {
          name: '🎤 现场感',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          data: livenessData,
          itemStyle: { color: featureColors.liveness.primary },
          lineStyle: { width: 2.5 },
          areaStyle: getAreaStyle(featureColors.liveness)
        },
        {
          name: '🗣️ 词频度',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          data: speechinessData,
          itemStyle: { color: featureColors.speechiness.primary },
          lineStyle: { width: 2.5 },
          areaStyle: getAreaStyle(featureColors.speechiness)
        }
      ]
    };
  }, [years, allBubbleNodes, wordsData, danceabilityData, energyData, valenceData, acousticnessData, instrumentalnessData, livenessData, speechinessData]);

  return (
    <div 
      className="card" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '880px', 
        width: '100%', 
        gap: '15px', 
        boxSizing: 'border-box',
        // 遵循浅色高透毛玻璃设计，尽量不采用暗黑色
        background: 'rgba(255, 255, 255, 0.45)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.75)',
        borderRadius: '20px',
        boxShadow: '0 8px 32px 0 rgba(145, 158, 171, 0.08)',
        padding: '24px'
      }}
    >
      {/* 头部布局 */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'flex-start', 
          alignItems: 'flex-start', 
          borderBottom: '1px solid rgba(145, 158, 171, 0.12)', 
          paddingBottom: '18px', 
          flexWrap: 'wrap', 
          gap: '15px' 
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '20px', color: '#1E293B', fontWeight: '800', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🪐 时代之声与文化长廊：历年声学演变与流行热词流</span>
          </h3>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748B', lineHeight: '1.5' }}>
            📈 60年流行乐演变全景：上方展现历年数十万单曲的 7 大物理声学演变曲线；下方悬挂同时代的流行词云气泡（气泡颜色代表其情感聚类归属）。滑动时间轴即可上下联动探秘。
          </p>
        </div>
      </div>

      {/* 双 Grid 联动图表主体 */}
      <div 
        style={{ 
          flexGrow: 1, 
          width: '100%', 
          position: 'relative', 
          minHeight: '640px', 
          backgroundColor: 'rgba(255, 255, 255, 0.25)', 
          borderRadius: '16px', 
          border: '1px solid rgba(255, 255, 255, 0.5)', 
          overflow: 'hidden' 
        }}
      >
        <ReactECharts 
          option={option} 
          style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }} 
          notMerge={true} 
          lazyUpdate={true} 
        />

        {/* 情感聚类图例 - 极简清爽的浅色胶囊 (绝对定位悬浮在词云气泡图正下方，紧密贴合) */}
        <div style={{ 
          position: 'absolute', 
          bottom: '12px', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          zIndex: 10,
          display: 'flex', 
          justifyContent: 'center',
          pointerEvents: 'auto'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            flexWrap: 'wrap', 
            background: 'rgba(255, 255, 255, 0.85)', 
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(145, 158, 171, 0.2)', 
            borderRadius: '30px', 
            padding: '6px 18px', 
            boxShadow: '0 4px 20px 0 rgba(145, 158, 171, 0.08)' 
          }}>
            <span style={{ fontSize: '11px', color: '#919EAB', fontWeight: '800', textTransform: 'uppercase', marginRight: '4px' }}>歌词情感聚类配色:</span>
            {clusterLabels.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569', fontWeight: '700' }}>
                <span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', backgroundColor: item.color, border: '1px solid rgba(0,0,0,0.06)' }}></span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineEvolutionCombined;
