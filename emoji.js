const usedEmojiTitles = new Set();

export function generateEmojiHints(data) {
  console.log("✅ Emoji round active");
  
  const emojiMap = {
    movie: "🎬", tv: "📺", game: "🎮", song: "🎵", artist: "🎤",
    action: "💥", comedy: "😂", drama: "🎭", horror: "👻", sci: "🚀", science: "🔬",
    fantasy: "✨", romance: "💕", thriller: "🔪", adventure: "🗺️", mystery: "🔍",
    space: "🌌", war: "⚔️", family: "👨‍👩‍👧‍👦", crime: "🕵️", superhero: "🦸",
    zombie: "🧟", robot: "🤖", alien: "👽", magic: "🪄", sword: "⚔️",
    gun: "🔫", car: "🚗", plane: "✈️", ship: "🚢", train: "🚂",
    city: "🏙️", forest: "🌲", ocean: "🌊", mountain: "⛰️", desert: "🏜️",
    love: "❤️", heart: "💖", star: "⭐", moon: "🌙", sun: "☀️",
    fire: "🔥", water: "💧", earth: "🌍", time: "⏰", clock: "🕐",
    money: "💰", crown: "👑", trophy: "🏆", medal: "🏅", flag: "🚩",
    key: "🗝️", lock: "🔒", door: "🚪", window: "🪟", house: "🏠",
    castle: "🏰", bridge: "🌉", tower: "🗼", knight: "🛡️", dragon: "🐉",
    wizard: "🧙", wand: "🪄", potion: "🧪", book: "📚", scroll: "📜",
    treasure: "💎", map: "🗺️", compass: "🧭", anchor: "⚓", lighthouse: "🗼",
    storm: "⛈️", lightning: "⚡", rainbow: "🌈", cloud: "☁️", snow: "❄️",
    child: "🧒", person: "👤", group: "👥", team: "👨‍👩‍👧‍👦", hero: "🦸",
    villain: "😈", monster: "👹", ghost: "👻", skull: "💀", crossbones: "☠️",
    snake: "🐍", spider: "🕷️", bat: "🦇", wolf: "🐺", cat: "🐱",
    dog: "🐕", horse: "🐴", bird: "🐦", fish: "🐟", bear: "🐻",
  };
  
  const hints = [];
  const titleLower = data.title.toLowerCase();
  const genreLower = (data.genre || "").toLowerCase();
  const overviewLower = (data.overview || "").toLowerCase();
  const allText = `${titleLower} ${genreLower} ${overviewLower}`;
  
  if (data.mediaType) {
    const mediaEmoji = emojiMap[data.mediaType] || "📀";
    if (!hints.includes(mediaEmoji)) hints.push(mediaEmoji);
  }
  
  Object.keys(emojiMap).forEach((key) => {
    if (allText.includes(key) && hints.length < 6) {
      const emoji = emojiMap[key];
      if (!hints.includes(emoji)) {
        hints.push(emoji);
      }
    }
  });
  
  const titleWords = titleLower.split(/\s+/).filter(w => w.length > 2);
  titleWords.forEach((word) => {
    if (emojiMap[word] && hints.length < 6) {
      const emoji = emojiMap[word];
      if (!hints.includes(emoji)) {
        hints.push(emoji);
      }
    }
  });
  
  const commonWords = ["the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or", "but"];
  const overviewWords = overviewLower.split(/\s+/)
    .filter(w => w.length > 3 && !commonWords.includes(w))
    .slice(0, 15);
    
  overviewWords.forEach((word) => {
    if (emojiMap[word] && hints.length < 6) {
      const emoji = emojiMap[word];
      if (!hints.includes(emoji)) {
        hints.push(emoji);
      }
    }
  });
  
  while (hints.length < 3) {
    const fallbackEmojis = ["🎬", "⭐", "🎭", "🎪", "🎨", "🎯"];
    const randomEmoji = fallbackEmojis[Math.floor(Math.random() * fallbackEmojis.length)];
    if (!hints.includes(randomEmoji)) {
      hints.push(randomEmoji);
    }
  }
  
  const finalHints = hints.slice(0, 6);
  return finalHints.join(" ");
}

export function checkEmojiAnswer(guess, correctTitle) {
  console.log("✅ Answer validated");
  
  if (!guess || !guess.trim()) {
    return { valid: false, error: "Enter your answer first" };
  }
  
  const normalizedGuess = guess.trim().toLowerCase();
  const normalizedCorrect = correctTitle.trim().toLowerCase();
  
  if (normalizedGuess === normalizedCorrect) {
    return { valid: true, correct: true };
  }
  
  if (normalizedGuess.includes(normalizedCorrect) || normalizedCorrect.includes(normalizedGuess)) {
    if (normalizedCorrect.length > 5 && normalizedGuess.length > 3) {
      return { valid: true, correct: true };
    }
  }
  
  return { valid: true, correct: false };
}

export function markEmojiTitleUsed(title) {
  usedEmojiTitles.add(title.toLowerCase());
}

export function isEmojiTitleUsed(title) {
  return usedEmojiTitles.has(title.toLowerCase());
}

export function resetEmojiUsed() {
  usedEmojiTitles.clear();
}

