export const SUCCESS_QUOTES = [
  "Harika bildin! Süper hafıza! 🎯",
  "Mükemmel! Zihninde çok taze. ✨",
  "Tam isabet! Harika gidiyorsun. 🎉",
  "Bravo! Kalıcı hafıza devrede. 🧠",
  "Kusursuz cevap! Aynen böyle devam. 🚀",
];

export const MOTIVATIONAL_QUOTES = [
  "Sorun değil, beyin tam olarak bu anlarda öğrenir ve güçlenir! 🧠",
  "Bunu hafıza sepetine aldık, bir dahaki sefere kesin hatırlayacaksın! ✨",
  "Şimdi doğrusunu gördün, artık kalıcı hafızaya geçiyor! 💡",
  "Aktif hatırlamanın sırrı burada: zorlanmak aslında öğrenmektir! 🚀",
  "Merak etme, bir sonraki tekrarda çok daha kolay olacak! 🎯",
  "Önemli olan denemek; nöral bağlar tam şu an güçleniyor! 🌱",
];

export function getRandomQuote(quotes: string[]): string {
  const index = Math.floor(Math.random() * quotes.length);
  return quotes[index] ?? quotes[0];
}
