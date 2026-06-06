const previewFrame = document.getElementById("previewFrame");
const previewTitle = document.getElementById("previewTitle");
const previewChip = document.getElementById("previewChip");
const previewFallback = document.getElementById("previewFallback");
const hubStatusPill = document.getElementById("hubStatusPill");
const hubStatusText = document.getElementById("hubStatusText");
const hubNote = document.getElementById("hubNote");
const cards = Array.from(document.querySelectorAll(".hub-launch-card"));

function activateCard(card) {
  const src = card.dataset.previewSrc;
  const label = card.dataset.label || "Preview";
  const copy = card.dataset.copy || "";

  cards.forEach((item) => item.classList.toggle("is-active", item === card));
  previewFrame.src = src;
  previewTitle.textContent = label;
  previewChip.textContent = src;
  hubStatusPill.textContent = label;
  hubStatusText.textContent = copy || "";
  hubNote.textContent = copy || "";
  previewFallback.querySelector("strong").textContent = label;
  previewFallback.querySelector("span").textContent = copy || "Open in a new tab if the preview does not load.";
}

cards.forEach((card) => {
  card.addEventListener("click", () => activateCard(card));
});

if (cards[0]) {
  activateCard(cards[0]);
}
