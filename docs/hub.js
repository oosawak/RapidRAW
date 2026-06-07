const hubNote = document.getElementById("hubNote");
const cards = Array.from(document.querySelectorAll(".hub-launch-card"));
const navButtons = Array.from(document.querySelectorAll("[data-hub-nav]"));

function activateCard(card) {
  const label = card.dataset.label || "Preview";
  const copy = card.dataset.copy || "";

  cards.forEach((item) => item.classList.toggle("is-active", item === card));
  if (hubNote) hubNote.textContent = copy || `${label} を開きます。`;
}

cards.forEach((card) => {
  card.addEventListener("click", () => activateCard(card));
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = cards.find((item) => item.dataset.previewSrc === `./${button.dataset.hubNav}.html`);
    if (target) {
      activateCard(target);
    }
  });
});

if (cards[0]) {
  activateCard(cards[0]);
}
