import type { Lang } from './catalogue'

// The cook's side of the app speaks her language. Message wording follows the decks
// ("Didi, kal kya banana hai aur kya khatam ho raha hai?").
const T = {
  greeting: { en: 'Namaste', hi: 'नमस्ते', te: 'నమస్తే' },
  prompt: {
    en: 'What is tomorrow’s dish, and what is running out?',
    hi: 'कल क्या बनाना है और क्या ख़त्म हो रहा है?',
    te: 'రేపు ఏం వండాలి, ఏమి అయిపోతోంది?',
  },
  q1: { en: 'Did you have everything today?', hi: 'आज सब मिला?', te: 'ఈరోజు అన్నీ దొరికాయా?' },
  yesAll: { en: 'Yes, everything', hi: 'हाँ, सब मिला', te: 'అవును, అన్నీ' },
  noSomething: { en: 'Something was missing', hi: 'कुछ कम था', te: 'ఏదో లేదు' },
  whatMissing: { en: 'What was missing?', hi: 'क्या कम था?', te: 'ఏమి లేదు?' },
  q2: { en: 'What will you make tomorrow?', hi: 'कल क्या बनाएँगी?', te: 'రేపు ఏం వండుతారు?' },
  suggested: { en: 'Suggested', hi: 'सुझाव', te: 'సూచన' },
  notSure: { en: 'Not decided', hi: 'पता नहीं', te: 'తెలియదు' },
  q3: { en: 'What is running out?', hi: 'क्या ख़त्म हो रहा है?', te: 'ఏమి అయిపోతోంది?' },
  staples: { en: 'Weekly check: atta, rice, oil, dal', hi: 'हफ़्ते की जाँच: आटा, चावल, तेल, दाल', te: 'వారపు తనిఖీ: పిండి, బియ్యం, నూనె, పప్పు' },
  voice: { en: 'Or just say it', hi: 'या बोल कर बताइए', te: 'లేదా చెప్పండి' },
  hold: { en: 'Tap to record', hi: 'रिकॉर्ड करने के लिए दबाएँ', te: 'రికార్డ్ చేయడానికి నొక్కండి' },
  stop: { en: 'Tap to stop', hi: 'रोकने के लिए दबाएँ', te: 'ఆపడానికి నొక్కండి' },
  send: { en: 'Send to the flat', hi: 'फ़्लैट को भेजें', te: 'ఫ్లాట్‌కి పంపండి' },
  sent: { en: 'Sent. Thank you!', hi: 'भेज दिया। धन्यवाद!', te: 'పంపబడింది. ధన్యవాదాలు!' },
  sentSub: {
    en: 'The flat will order tonight. Everything will be here when you come.',
    hi: 'फ़्लैट आज रात ऑर्डर करेगा। आप आएँगी तो सब मिलेगा।',
    te: 'ఫ్లాట్ ఈ రాత్రి ఆర్డర్ చేస్తుంది. మీరు వచ్చేసరికి అన్నీ ఉంటాయి.',
  },
  edit: { en: 'Change my note', hi: 'बदलें', te: 'మార్చండి' },
  ordered: { en: 'Ordered by', hi: 'ऑर्डर किया', te: 'ఆర్డర్ చేసినవారు' },
  waitingOrder: { en: 'Not ordered yet', hi: 'अभी ऑर्डर नहीं हुआ', te: 'ఇంకా ఆర్డర్ కాలేదు' },
  tomorrowList: { en: 'Tomorrow’s list', hi: 'कल की लिस्ट', te: 'రేపటి జాబితా' },
  dayOff: { en: 'Not coming tomorrow', hi: 'कल नहीं आऊँगी', te: 'రేపు రాను' },
} as const

export type Key = keyof typeof T
export const t = (k: Key, lang: Lang) => T[k][lang]
