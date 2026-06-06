const previewFrame = document.getElementById("previewFrame");
const previewFallback = document.getElementById("previewFallback");

if (previewFrame && previewFallback) {
  previewFallback.querySelector("strong").textContent = "Oekaki Chat Preview";
  previewFallback.querySelector("span").textContent = "上のリンクから、Pages で見るデモを別タブでも開けます。";
  previewFrame.src = "./demo.html";
}
