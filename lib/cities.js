// 城市對照表：給 /api/weather 與 Discord 推播共用。

export const DEFAULT_CITY_SLUG = 'taipei'

export const CITIES = [
  {
    slug: 'taipei',
    name: '台北',
    aliases: ['taipei', 'taipeh'],
    latitude: 25.033,
    longitude: 121.5654,
  },
  {
    slug: 'new-taipei',
    name: '新北',
    aliases: ['newtaipei', 'banqiao', '板橋'],
    latitude: 25.0169,
    longitude: 121.4628,
  },
  {
    slug: 'keelung',
    name: '基隆',
    aliases: ['keelung'],
    latitude: 25.1276,
    longitude: 121.7392,
  },
  {
    slug: 'taoyuan',
    name: '桃園',
    aliases: ['taoyuan'],
    latitude: 24.9936,
    longitude: 121.301,
  },
  {
    slug: 'hsinchu',
    name: '新竹',
    aliases: ['hsinchu', 'zhubei', '竹北'],
    latitude: 24.8138,
    longitude: 120.9675,
  },
  {
    slug: 'miaoli',
    name: '苗栗',
    aliases: ['miaoli'],
    latitude: 24.5602,
    longitude: 120.8214,
  },
  {
    slug: 'taichung',
    name: '台中',
    aliases: ['taichung'],
    latitude: 24.1477,
    longitude: 120.6736,
  },
  {
    slug: 'changhua',
    name: '彰化',
    aliases: ['changhua'],
    latitude: 24.0518,
    longitude: 120.5161,
  },
  {
    slug: 'nantou',
    name: '南投',
    aliases: ['nantou'],
    latitude: 23.9609,
    longitude: 120.9719,
  },
  {
    slug: 'yunlin',
    name: '雲林',
    aliases: ['yunlin', 'douliu', '斗六'],
    latitude: 23.7075,
    longitude: 120.5439,
  },
  {
    slug: 'chiayi',
    name: '嘉義',
    aliases: ['chiayi'],
    latitude: 23.4801,
    longitude: 120.4491,
  },
  {
    slug: 'tainan',
    name: '台南',
    aliases: ['tainan'],
    latitude: 22.9999,
    longitude: 120.2269,
  },
  {
    slug: 'kaohsiung',
    name: '高雄',
    aliases: ['kaohsiung'],
    latitude: 22.6273,
    longitude: 120.3014,
  },
  {
    slug: 'pingtung',
    name: '屏東',
    aliases: ['pingtung'],
    latitude: 22.669,
    longitude: 120.4881,
  },
  {
    slug: 'yilan',
    name: '宜蘭',
    aliases: ['yilan', 'ilan'],
    latitude: 24.7021,
    longitude: 121.7378,
  },
  {
    slug: 'hualien',
    name: '花蓮',
    aliases: ['hualien'],
    latitude: 23.9871,
    longitude: 121.6015,
  },
  {
    slug: 'taitung',
    name: '台東',
    aliases: ['taitung'],
    latitude: 22.7583,
    longitude: 121.1444,
  },
  {
    slug: 'penghu',
    name: '澎湖',
    aliases: ['penghu', 'magong', '馬公'],
    latitude: 23.5655,
    longitude: 119.5664,
  },
  {
    slug: 'kinmen',
    name: '金門',
    aliases: ['kinmen', 'quemoy'],
    latitude: 24.4321,
    longitude: 118.3171,
  },
  {
    slug: 'lienchiang',
    name: '連江',
    aliases: ['lienchiang', 'matsu', '馬祖', '南竿'],
    latitude: 26.1608,
    longitude: 119.949,
  },
]

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/臺/g, '台')
    .replace(/[市縣]$/, '')
    .replace(/city$/, '')
}

const INDEX = new Map()

for (const city of CITIES) {
  for (const key of [city.slug, city.name, ...city.aliases]) {
    INDEX.set(normalize(key), city)
  }
}

/**
 * 把使用者輸入的城市字串換成城市物件。
 * 空字串／undefined 視為預設城市（台北）；查不到回 null，由呼叫端決定錯誤碼。
 */
export function resolveCity(input) {
  const key = normalize(input)
  if (key === '') return INDEX.get(DEFAULT_CITY_SLUG) ?? null
  return INDEX.get(key) ?? null
}

/** 錯誤訊息用：列出支援的城市名稱。 */
export function supportedCityNames() {
  return CITIES.map((city) => city.name)
}
