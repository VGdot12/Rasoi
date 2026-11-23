// Ingredients with a picture and names in English, Hindi and Telugu,
// so a cook who cannot read can still tap what is running low.

export type Lang = 'en' | 'hi' | 'te'

export interface Ingredient {
  key: string
  emoji: string
  en: string
  hi: string
  te: string
  qty: string // default quantity for the order list
  staple?: boolean
  veg?: boolean // fresh produce: freshness matters
}

export const INGREDIENTS: Ingredient[] = [
  { key: 'onion', emoji: '🧅', en: 'Onions', hi: 'प्याज़', te: 'ఉల్లిపాయ', qty: '1 kg', veg: true },
  { key: 'tomato', emoji: '🍅', en: 'Tomatoes', hi: 'टमाटर', te: 'టమాటా', qty: '500 g', veg: true },
  { key: 'potato', emoji: '🥔', en: 'Potatoes', hi: 'आलू', te: 'బంగాళదుంప', qty: '1 kg', veg: true },
  { key: 'milk', emoji: '🥛', en: 'Milk', hi: 'दूध', te: 'పాలు', qty: '1 L' },
  { key: 'curd', emoji: '🍶', en: 'Curd', hi: 'दही', te: 'పెరుగు', qty: '400 g' },
  { key: 'paneer', emoji: '🧀', en: 'Paneer', hi: 'पनीर', te: 'పనీర్', qty: '200 g' },
  { key: 'egg', emoji: '🥚', en: 'Eggs', hi: 'अंडे', te: 'గుడ్లు', qty: '6 pc' },
  { key: 'chilli', emoji: '🌶️', en: 'Green chillies', hi: 'हरी मिर्च', te: 'పచ్చి మిర్చి', qty: '100 g', veg: true },
  { key: 'coriander', emoji: '🌿', en: 'Coriander', hi: 'धनिया', te: 'కొత్తిమీర', qty: '1 bunch', veg: true },
  { key: 'ginger', emoji: '🫚', en: 'Ginger', hi: 'अदरक', te: 'అల్లం', qty: '100 g', veg: true },
  { key: 'garlic', emoji: '🧄', en: 'Garlic', hi: 'लहसुन', te: 'వెల్లుల్లి', qty: '100 g', veg: true },
  { key: 'lemon', emoji: '🍋', en: 'Lemons', hi: 'नींबू', te: 'నిమ్మకాయ', qty: '4 pc', veg: true },
  { key: 'capsicum', emoji: '🫑', en: 'Capsicum', hi: 'शिमला मिर्च', te: 'క్యాప్సికం', qty: '250 g', veg: true },
  { key: 'bhindi', emoji: '🥒', en: 'Bhindi', hi: 'भिंडी', te: 'బెండకాయ', qty: '500 g', veg: true },
  { key: 'spinach', emoji: '🥬', en: 'Spinach', hi: 'पालक', te: 'పాలకూర', qty: '1 bunch', veg: true },
  { key: 'carrot', emoji: '🥕', en: 'Carrots', hi: 'गाजर', te: 'క్యారెట్', qty: '500 g', veg: true },
  { key: 'peas', emoji: '🫛', en: 'Peas', hi: 'मटर', te: 'బఠానీ', qty: '250 g', veg: true },
  { key: 'brinjal', emoji: '🍆', en: 'Brinjal', hi: 'बैंगन', te: 'వంకాయ', qty: '500 g', veg: true },
  { key: 'chicken', emoji: '🍗', en: 'Chicken', hi: 'चिकन', te: 'చికెన్', qty: '500 g' },
  { key: 'bread', emoji: '🍞', en: 'Bread', hi: 'ब्रेड', te: 'బ్రెడ్', qty: '1 pack' },
  { key: 'butter', emoji: '🧈', en: 'Butter / ghee', hi: 'घी', te: 'నెయ్యి', qty: '200 g' },
  { key: 'atta', emoji: '🌾', en: 'Atta', hi: 'आटा', te: 'గోధుమ పిండి', qty: '5 kg', staple: true },
  { key: 'rice', emoji: '🍚', en: 'Rice', hi: 'चावल', te: 'బియ్యం', qty: '5 kg', staple: true },
  { key: 'oil', emoji: '🫙', en: 'Oil', hi: 'तेल', te: 'నూనె', qty: '1 L', staple: true },
  { key: 'dal', emoji: '🫘', en: 'Dal', hi: 'दाल', te: 'పప్పు', qty: '1 kg', staple: true },
]

export const STAPLE_KEYS = ['atta', 'rice', 'oil', 'dal']

export const byKey = (k: string) => INGREDIENTS.find((i) => i.key === k)

export const nameOf = (k: string, lang: Lang = 'en') => {
  const i = byKey(k)
  if (!i) return k // a custom item typed by a flatmate
  return lang === 'en' ? i.en : `${i[lang]}`
}

export const emojiOf = (k: string) => byKey(k)?.emoji ?? '🛒'

export const DISH_IDEAS = [
  'Rajma chawal', 'Aloo gobi', 'Dal tadka', 'Chole', 'Paneer bhurji', 'Bhindi masala', 'Kadhi chawal', 'Aloo paratha',
  'Matar paneer', 'Egg curry', 'Baingan bharta', 'Jeera aloo', 'Palak dal', 'Veg pulao', 'Sambar rice', 'Tomato pappu',
  'Curd rice', 'Chicken curry', 'Poha', 'Upma',
]
