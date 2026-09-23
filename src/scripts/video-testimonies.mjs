import { ytId, ytEmbed } from '../lib/youtube.mjs';

// Плеєр вставляється лише після кліку: iframe YouTube важкий, а відеокарток
// кілька. Кнопка замінюється цілком — як у легасі, щоб фокус не лишився на
// невидимому елементі.
export function bindVideoTestimonies(root, title) {
  for (const button of root.querySelectorAll('.tst-video')) {
    button.addEventListener('click', () => {
      const id = ytId(button.getAttribute('data-yt'));
      if (!id) return;
      const frame = document.createElement('iframe');
      frame.src = ytEmbed(id, { autoplay: true });
      frame.title = title;
      frame.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
      frame.setAttribute('allowfullscreen', '');
      button.replaceWith(frame);
    });
  }
}
