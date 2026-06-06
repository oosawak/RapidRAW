const previewFrame = document.getElementById("previewFrame");
const previewTitle = document.getElementById("previewTitle");
const previewChip = document.getElementById("previewChip");
const previewFallback = document.getElementById("previewFallback");
const hubNote = document.getElementById("hubNote");
const cards = Array.from(document.querySelectorAll(".hub-launch-card"));
const navButtons = Array.from(document.querySelectorAll("[data-hub-nav]"));

const previewByKey = {
  demo: {
    src: "./demo.html",
    label: "Demo",
    copy: "コラボ描画の確認用画面。キャンバスとストロークフィードを見られます。",
  },
  rapidraw: {
    src: "./rapidraw.html",
    label: "RapidRAW",
    copy: "RapidRAW 風の写真編集プレビュー。調整 UI と PNG 書き出しを確認できます。",
  },
};

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

function activateByKey(key) {
  const target = previewByKey[key];
  if (!target || !previewFrame) return;
  const card = cards.find((item) => item.dataset.previewSrc === target.src);
  if (card) {
    activateCard(card);
    return;
  }
  previewFrame.src = target.src;
  if (previewTitle) previewTitle.textContent = target.label;
  if (previewChip) previewChip.textContent = target.src;
  if (hubNote) hubNote.textContent = target.copy;
}

cards.forEach((card) => {
  card.addEventListener("click", () => activateCard(card));
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => activateByKey(button.dataset.hubNav));
});

if (cards[0]) {
  activateCard(cards[0]);
}
