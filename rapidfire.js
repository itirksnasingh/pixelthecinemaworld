export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function generateFallbackOptions(correctAnswer, title, genre, overview) {
  const keywords = [];
  const text = `${title} ${genre} ${overview}`.toLowerCase();
  
  const commonWords = text.split(/\s+/)
    .filter(w => w.length > 4)
    .filter(w => !["the", "that", "this", "with", "from", "about", "their", "there"].includes(w))
    .slice(0, 10);
  
  keywords.push(...commonWords);
  
  const options = [correctAnswer];
  
  const genericOptions = [
    "Iconic characters",
    "Groundbreaking visuals",
    "Memorable soundtrack",
    "Plot twists",
    "Character development",
    "Visual effects",
    "Emotional depth",
    "Action sequences",
    "Dialogue quality",
    "Cinematic style"
  ];
  
  while (options.length < 4) {
    const random = genericOptions[Math.floor(Math.random() * genericOptions.length)];
    if (!options.includes(random)) {
      options.push(random);
    }
  }
  
  return shuffleArray(options);
}

export function prepareRapidQuestion(question, title, genre, overview) {
  console.log("✅ Rapid Fire active");
  
  let options = question.options || [];
  const answer = question.answer || (options[0] || "Option A");
  
  if (!options || options.length === 0 || options.every(opt => opt.startsWith("Option"))) {
    options = generateFallbackOptions(answer, title, genre, overview);
  }
  
  if (options.length < 4) {
    const fallback = generateFallbackOptions(answer, title, genre, overview);
    while (options.length < 4) {
      const random = fallback[Math.floor(Math.random() * fallback.length)];
      if (!options.includes(random)) {
        options.push(random);
      }
    }
  }
  
  const shuffledOptions = shuffleArray(options.slice(0, 4));
  const correctIndex = shuffledOptions.findIndex(opt => 
    opt === answer || opt.toLowerCase() === answer.toLowerCase()
  );
  
  return {
    ...question,
    options: shuffledOptions,
    answer: shuffledOptions[correctIndex >= 0 ? correctIndex : 0],
    originalAnswer: answer
  };
}

export function checkRapidAnswer(selected, correct) {
  if (!selected || !correct) return false;
  
  const normalizedSelected = selected.trim().toLowerCase();
  const normalizedCorrect = correct.trim().toLowerCase();
  
  return normalizedSelected === normalizedCorrect;
}

