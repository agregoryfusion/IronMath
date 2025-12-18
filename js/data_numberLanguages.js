// data_numberLanguages.js - spelled-out numbers (1-100) for multiple languages
const FM = (window.FastMath = window.FastMath || {});

function frenchSub20(n) {
  const units = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const teens = {
    10: "dix",
    11: "onze",
    12: "douze",
    13: "treize",
    14: "quatorze",
    15: "quinze",
    16: "seize",
    17: "dix-sept",
    18: "dix-huit",
    19: "dix-neuf"
  };
  if (n < 10) return units[n];
  return teens[n] || "";
}

function frenchNumber(n) {
  if (n === 100) return "cent";
  if (n < 20) return frenchSub20(n);
  if (n < 70) {
    const tensWords = { 20: "vingt", 30: "trente", 40: "quarante", 50: "cinquante", 60: "soixante" };
    const tens = Math.floor(n / 10) * 10;
    const unit = n % 10;
    const base = tensWords[tens] || "";
    if (unit === 0) return base;
    if (unit === 1) return `${base}-et-un`;
    return `${base}-${frenchSub20(unit)}`;
  }
  if (n < 80) {
    const remainder = n - 60;
    if (remainder === 11) return "soixante-et-onze";
    return `soixante-${frenchSub20(remainder)}`;
  }
  const remainder = n - 80;
  if (remainder === 0) return "quatre-vingts";
  const prefix = "quatre-vingt";
  if (remainder === 1) return `${prefix}-un`;
  return `${prefix}-${frenchSub20(remainder)}`;
}

function germanNumber(n) {
  const units = {
    0: "null",
    1: "eins",
    2: "zwei",
    3: "drei",
    4: "vier",
    5: "fünf",
    6: "sechs",
    7: "sieben",
    8: "acht",
    9: "neun"
  };
  const teens = {
    10: "zehn",
    11: "elf",
    12: "zwölf",
    13: "dreizehn",
    14: "vierzehn",
    15: "fünfzehn",
    16: "sechzehn",
    17: "siebzehn",
    18: "achtzehn",
    19: "neunzehn"
  };
  const tensWords = {
    20: "zwanzig",
    30: "dreißig",
    40: "vierzig",
    50: "fünfzig",
    60: "sechzig",
    70: "siebzig",
    80: "achtzig",
    90: "neunzig"
  };

  if (n === 100) return "hundert";
  if (n < 10) return units[n];
  if (n < 20) return teens[n];
  if (n % 10 === 0) return tensWords[n];
  const tens = Math.floor(n / 10) * 10;
  const unit = n % 10;
  const unitWord = unit === 1 ? "ein" : units[unit];
  return `${unitWord}und${tensWords[tens]}`;
}

function spanishNumber(n) {
  const lookup = {
    1: "uno",
    2: "dos",
    3: "tres",
    4: "cuatro",
    5: "cinco",
    6: "seis",
    7: "siete",
    8: "ocho",
    9: "nueve",
    10: "diez",
    11: "once",
    12: "doce",
    13: "trece",
    14: "catorce",
    15: "quince",
    16: "dieciséis",
    17: "diecisiete",
    18: "dieciocho",
    19: "diecinueve",
    20: "veinte",
    21: "veintiuno",
    22: "veintidós",
    23: "veintitrés",
    24: "veinticuatro",
    25: "veinticinco",
    26: "veintiséis",
    27: "veintisiete",
    28: "veintiocho",
    29: "veintinueve"
  };
  const tensWords = {
    30: "treinta",
    40: "cuarenta",
    50: "cincuenta",
    60: "sesenta",
    70: "setenta",
    80: "ochenta",
    90: "noventa"
  };

  if (n === 100) return "cien";
  if (lookup[n]) return lookup[n];
  const tens = Math.floor(n / 10) * 10;
  const unit = n % 10;
  const tensWord = tensWords[tens] || "";
  if (unit === 0) return tensWord;
  const units = { 1: "uno", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis", 7: "siete", 8: "ocho", 9: "nueve" };
  return `${tensWord} y ${units[unit]}`;
}

function italianNumber(n) {
  const units = {
    0: "",
    1: "uno",
    2: "due",
    3: "tre",
    4: "quattro",
    5: "cinque",
    6: "sei",
    7: "sette",
    8: "otto",
    9: "nove"
  };
  const teens = {
    10: "dieci",
    11: "undici",
    12: "dodici",
    13: "tredici",
    14: "quattordici",
    15: "quindici",
    16: "sedici",
    17: "diciassette",
    18: "diciotto",
    19: "diciannove"
  };
  const tensWords = {
    20: "venti",
    30: "trenta",
    40: "quaranta",
    50: "cinquanta",
    60: "sessanta",
    70: "settanta",
    80: "ottanta",
    90: "novanta"
  };

  if (n === 100) return "cento";
  if (n < 10) return units[n];
  if (n < 20) return teens[n];
  const tens = Math.floor(n / 10) * 10;
  const unit = n % 10;
  let tensWord = tensWords[tens] || "";
  if (unit === 0) return tensWord;
  if (unit === 1 || unit === 8) {
    tensWord = tensWord.slice(0, -1);
  }
  let unitWord = units[unit];
  if (unit === 3) unitWord = "tré";
  return `${tensWord}${unitWord}`;
}

function portugueseNumber(n) {
  const lookup = {
    1: "um",
    2: "dois",
    3: "três",
    4: "quatro",
    5: "cinco",
    6: "seis",
    7: "sete",
    8: "oito",
    9: "nove",
    10: "dez",
    11: "onze",
    12: "doze",
    13: "treze",
    14: "catorze",
    15: "quinze",
    16: "dezesseis",
    17: "dezessete",
    18: "dezoito",
    19: "dezenove",
    20: "vinte"
  };
  const tensWords = {
    20: "vinte",
    30: "trinta",
    40: "quarenta",
    50: "cinquenta",
    60: "sessenta",
    70: "setenta",
    80: "oitenta",
    90: "noventa"
  };
  if (n === 100) return "cem";
  if (lookup[n]) return lookup[n];
  const tens = Math.floor(n / 10) * 10;
  const unit = n % 10;
  const tensWord = tensWords[tens] || "";
  if (unit === 0) return tensWord;
  return `${tensWord} e ${lookup[unit] || ""}`.trim();
}

function dutchNumber(n) {
  const units = {
    0: "",
    1: "een",
    2: "twee",
    3: "drie",
    4: "vier",
    5: "vijf",
    6: "zes",
    7: "zeven",
    8: "acht",
    9: "negen"
  };
  const teens = {
    10: "tien",
    11: "elf",
    12: "twaalf",
    13: "dertien",
    14: "veertien",
    15: "vijftien",
    16: "zestien",
    17: "zeventien",
    18: "achttien",
    19: "negentien"
  };
  const tensWords = {
    20: "twintig",
    30: "dertig",
    40: "veertig",
    50: "vijftig",
    60: "zestig",
    70: "zeventig",
    80: "tachtig",
    90: "negentig"
  };

  if (n === 100) return "honderd";
  if (n < 10) return units[n];
  if (n < 20) return teens[n];
  const tens = Math.floor(n / 10) * 10;
  const unit = n % 10;
  const tensWord = tensWords[tens] || "";
  if (unit === 0) return tensWord;
  const link = unit === 2 || unit === 3 ? "ën" : "en";
  return `${units[unit]}${link}${tensWord}`;
}

function swedishNumber(n) {
  const units = {
    0: "",
    1: "ett",
    2: "två",
    3: "tre",
    4: "fyra",
    5: "fem",
    6: "sex",
    7: "sju",
    8: "åtta",
    9: "nio"
  };
  const teens = {
    10: "tio",
    11: "elva",
    12: "tolv",
    13: "tretton",
    14: "fjorton",
    15: "femton",
    16: "sexton",
    17: "sjutton",
    18: "arton",
    19: "nitton"
  };
  const tensWords = {
    20: "tjugo",
    30: "trettio",
    40: "fyrtio",
    50: "femtio",
    60: "sextio",
    70: "sjuttio",
    80: "åttio",
    90: "nittio"
  };
  if (n === 100) return "hundra";
  if (n < 10) return units[n];
  if (n < 20) return teens[n];
  const tens = Math.floor(n / 10) * 10;
  const unit = n % 10;
  const tensWord = tensWords[tens] || "";
  if (unit === 0) return tensWord;
  return `${tensWord}${units[unit]}`;
}

function norwegianNumber(n) {
  const units = {
    0: "",
    1: "en",
    2: "to",
    3: "tre",
    4: "fire",
    5: "fem",
    6: "seks",
    7: "sju",
    8: "åtte",
    9: "ni"
  };
  const teens = {
    10: "ti",
    11: "elleve",
    12: "tolv",
    13: "tretten",
    14: "fjorten",
    15: "femten",
    16: "seksten",
    17: "sytten",
    18: "atten",
    19: "nitten"
  };
  const tensWords = {
    20: "tjue",
    30: "tretti",
    40: "førti",
    50: "femti",
    60: "seksti",
    70: "sytti",
    80: "åtti",
    90: "nitti"
  };
  if (n === 100) return "hundre";
  if (n < 10) return units[n];
  if (n < 20) return teens[n];
  const tens = Math.floor(n / 10) * 10;
  const unit = n % 10;
  const tensWord = tensWords[tens] || "";
  if (unit === 0) return tensWord;
  return `${tensWord}${units[unit]}`;
}

function buildList(fn) {
  const arr = new Array(101);
  for (let i = 1; i <= 100; i++) {
    arr[i] = fn(i);
  }
  return arr;
}

function computeCollisions(wordsByLang, languages) {
  const collisions = {};
  for (let n = 1; n <= 100; n++) {
    const bucket = {};
    languages.forEach((lang) => {
      const word = wordsByLang[lang][n];
      bucket[word] = bucket[word] || [];
      bucket[word].push(lang);
    });
    const perNumber = {};
    Object.values(bucket).forEach((langs) => {
      if (langs.length > 1) {
        langs.forEach((l) => {
          perNumber[l] = langs;
        });
      }
    });
    collisions[n] = perNumber;
  }
  return collisions;
}

function buildData(languages, wordMap) {
  return {
    LANGUAGES: languages,
    WORDS: wordMap,
    COLLISIONS: computeCollisions(wordMap, languages),
    NUMBERS: Array.from({ length: 100 }, (_, i) => i + 1)
  };
}

const ROMANCE_LANGUAGES = ["Portuguese", "French", "Spanish", "Italian"];
const GERMANIC_LANGUAGES = ["Dutch", "German", "Swedish", "Norwegian"];

const ROMANCE_WORDS = {
  French: buildList(frenchNumber),
  Spanish: buildList(spanishNumber),
  Portuguese: buildList(portugueseNumber),
  Italian: buildList(italianNumber)
};

const GERMANIC_WORDS = {
  Dutch: buildList(dutchNumber),
  German: buildList(germanNumber),
  Swedish: buildList(swedishNumber),
  Norwegian: buildList(norwegianNumber)
};

FM.numberLanguageDataRomance = buildData(ROMANCE_LANGUAGES, ROMANCE_WORDS);
FM.numberLanguageDataGermanic = buildData(GERMANIC_LANGUAGES, GERMANIC_WORDS);
FM.numberLanguageData = FM.numberLanguageDataRomance;
