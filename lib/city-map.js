// 城市名稱對照表：把使用者輸入（英文拼音／常見中文簡稱／官方全名）正規化成
// CWA（中央氣象署）開放資料用的縣市全名，並附上一個用來查即時觀測（O-A0003-001）
// 的代表測站。部分縣市沒有市區型測站，stationName 留 null，現在天氣會改用
// 預報資料（F-D0047-089）補齊，不會整段掛掉。

export const OFFICIAL_COUNTIES = [
  '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市',
  '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '臺東縣', '澎湖縣', '金門縣', '連江縣',
]

// key 一律用小寫英文或「台／臺」皆可的中文簡稱比對
const ALIASES = {
  taipei: '臺北市', 台北: '臺北市', 台北市: '臺北市',
  newtaipei: '新北市', 新北: '新北市', 新北市: '新北市',
  taoyuan: '桃園市', 桃園: '桃園市', 桃園市: '桃園市',
  taichung: '臺中市', 台中: '臺中市', 台中市: '臺中市',
  tainan: '臺南市', 台南: '臺南市', 台南市: '臺南市',
  kaohsiung: '高雄市', 高雄: '高雄市', 高雄市: '高雄市',
  keelung: '基隆市', 基隆: '基隆市', 基隆市: '基隆市',
  hsinchucity: '新竹市', 新竹市: '新竹市',
  hsinchucounty: '新竹縣', 新竹縣: '新竹縣',
  新竹: '新竹市',
  miaoli: '苗栗縣', 苗栗: '苗栗縣', 苗栗縣: '苗栗縣',
  changhua: '彰化縣', 彰化: '彰化縣', 彰化縣: '彰化縣',
  nantou: '南投縣', 南投: '南投縣', 南投縣: '南投縣',
  yunlin: '雲林縣', 雲林: '雲林縣', 雲林縣: '雲林縣',
  chiayicity: '嘉義市', 嘉義市: '嘉義市',
  chiayicounty: '嘉義縣', 嘉義縣: '嘉義縣',
  嘉義: '嘉義市',
  pingtung: '屏東縣', 屏東: '屏東縣', 屏東縣: '屏東縣',
  yilan: '宜蘭縣', 宜蘭: '宜蘭縣', 宜蘭縣: '宜蘭縣',
  hualien: '花蓮縣', 花蓮: '花蓮縣', 花蓮縣: '花蓮縣',
  taitung: '臺東縣', 台東: '臺東縣', 台東縣: '臺東縣',
  penghu: '澎湖縣', 澎湖: '澎湖縣', 澎湖縣: '澎湖縣',
  kinmen: '金門縣', 金門: '金門縣', 金門縣: '金門縣',
  lienchiang: '連江縣', 連江: '連江縣', 連江縣: '連江縣', 馬祖: '連江縣',
}

// 各縣市用來查「現在天氣觀測」(O-A0003-001) 的代表測站；沒有合適市區測站的先留 null
const STATIONS = {
  臺北市: '臺北',
  新北市: '新北',
  桃園市: '桃園',
  臺中市: '臺中',
  臺南市: '臺南',
  高雄市: '高雄',
  基隆市: '基隆',
  新竹市: '新竹',
  新竹縣: '新竹',
  苗栗縣: '後龍',
  彰化縣: '彰師大',
  南投縣: '日月潭',
  雲林縣: '古坑',
  嘉義市: '嘉義',
  嘉義縣: '嘉義',
  屏東縣: '屏東',
  宜蘭縣: '宜蘭',
  花蓮縣: '花蓮',
  臺東縣: '臺東',
  澎湖縣: '澎湖',
  金門縣: '金門',
  連江縣: '馬祖',
}

function normalizeKey(raw) {
  return raw.trim().replace(/台/g, '臺')
}

// 回傳 { countyName, stationName } 或 null（查無此城市）
export function resolveCity(rawQuery) {
  if (!rawQuery) return null
  const trimmed = rawQuery.trim()
  const normalized = normalizeKey(trimmed)

  let countyName = null
  if (OFFICIAL_COUNTIES.includes(normalized)) {
    countyName = normalized
  } else {
    const aliasKey = normalized.replace(/臺/g, '台').toLowerCase().replace(/\s+/g, '')
    countyName = Object.hasOwn(ALIASES, aliasKey) ? ALIASES[aliasKey] : null
  }

  if (!countyName) return null
  return { countyName, stationName: STATIONS[countyName] ?? null }
}
