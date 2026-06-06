const previewFrame = document.getElementById("previewFrame");
const previewTitle = document.getElementById("previewTitle");
const previewChip = document.getElementById("previewChip");
const previewFallback = document.getElementById("previewFallback");
const hubNote = document.getElementById("hubNote");
const cards = Array.from(document.querySelectorAll(".hub-launch-card"));

function activateCard(card) {
  const src = card.dataset.previewSrc;
  const label = card.dataset.label || "Preview";
  const copy = card.dataset.copy || "";

  cards.forEach((item) => item.classList.toggle("is-active", item === card));
  if (previewFrame) previewFrame.src = src;
  if (previewTitle) previewTitle.textContent = label;
  if (previewChip) previewChip.textContent = src;
  if (hubNote) hubNote.textContent = copy || "";
  if (previewFallback) {
    const title = previewFallback.querySelector("strong");
    const body = previewFallback.querySelector("span");
    if (title) title.textContent = label;
    if (body) body.textContent = copy || "表示されない場合はボタンから別タブで開いてください。";
  }
}

cards.forEach((card) => {
  card.addEventListener("click", () => activateCard(card));
});

if (cards[0]) {
  activateCard(cards[0]);
}
