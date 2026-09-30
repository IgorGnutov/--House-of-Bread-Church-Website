// Гортання горизонтальної стрічки кнопками ← →: до сусідньої картки від
// тієї, що зараз біля лівого краю. Стрічка сама — overflow-x і scroll-snap,
// тож без скрипту її гортають пальцем чи колесом. Спільне для свідчень і
// стрічки Facebook (Спека 5).
export function bindCarousel(track, prev, next) {
  const cards = () => Array.from(track.children);
  const cardLeft = (card) => card.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
  const currentIndex = () => {
    let idx = 0;
    let min = Infinity;
    cards().forEach((card, i) => {
      const d = Math.abs(cardLeft(card) - track.scrollLeft);
      if (d < min) { min = d; idx = i; }
    });
    return idx;
  };
  const goTo = (i) => {
    const list = cards();
    const target = list[Math.max(0, Math.min(list.length - 1, i))];
    if (target) track.scrollTo({ left: cardLeft(target), behavior: 'smooth' });
  };
  next?.addEventListener('click', () => goTo(currentIndex() + 1));
  prev?.addEventListener('click', () => goTo(currentIndex() - 1));
}
