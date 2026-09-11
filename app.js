const feeRate = 0.15;
const shipping = 5.00;

let product = null;
let stream = null;

const $ = id => document.getElementById(id);

function setProduct(p) {
  product = p;
  $("productTitle").textContent = p.title;
  $("platform").textContent = p.platform;
  $("upc").textContent = p.upc;
  $("marketPrice").textContent = money(p.marketPrice);
  $("productCard").classList.remove("hidden");
  $("dealCard").classList.remove("hidden");
  $("cost").focus();
  calculate();
}

function money(n) {
  return new Intl.NumberFormat("en-US", {style:"currency", currency:"USD"}).format(n);
}

function calculate() {
  if (!product) return;
  const cost = Number($("cost").value);
  if (!(cost > 0)) {
    $("fees").textContent = money(product.marketPrice * feeRate);
    $("shipping").textContent = money(shipping);
    $("net").textContent = money(product.marketPrice * (1-feeRate) - shipping);
    $("profit").textContent = "$0.00";
    $("roi").textContent = "0%";
    $("verdict").textContent = "Enter your purchase price";
    $("verdict").className = "verdict neutral";
    return;
  }

  const fees = product.marketPrice * feeRate;
  const net = product.marketPrice - fees - shipping;
  const profit = net - cost;
  const roi = profit / cost * 100;

  $("fees").textContent = money(fees);
  $("shipping").textContent = money(shipping);
  $("net").textContent = money(net);
  $("profit").textContent = money(profit);
  $("roi").textContent = `${roi.toFixed(0)}%`;

  let text, cls;
  if (roi >= 100) { text = "🟢 GREAT BUY"; cls = "great"; }
  else if (roi >= 50) { text = "🟢 BUY"; cls = "buy"; }
  else if (roi >= 25) { text = "🟡 MAYBE"; cls = "maybe"; }
  else if (roi >= 0) { text = "🟠 LOW MARGIN"; cls = "low"; }
  else { text = "🔴 PASS"; cls = "pass"; }

  $("verdict").textContent = text;
  $("verdict").className = `verdict ${cls}`;
}

$("cost").addEventListener("input", calculate);

$("scanBtn").addEventListener("click", async () => {
  const scanner = $("scanner");
  scanner.classList.remove("hidden");
  $("scanStatus").textContent = "";
  try {
    if (!("BarcodeDetector" in window)) {
      $("scanStatus").textContent = "Live barcode detection isn't supported by this browser yet. Use the sample lookup below.";
      return;
    }
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});
    $("video").srcObject = stream;
    await $("video").play();
    const detector = new BarcodeDetector({formats:["upc_a","upc_e","ean_13","ean_8"]});
    const scan = async () => {
      if (scanner.classList.contains("hidden")) return;
      try {
        const codes = await detector.detect($("video"));
        if (codes.length) {
          const code = codes[0].rawValue;
          $("scanStatus").textContent = `Scanned: ${code}`;
          setProduct({
            title: "Sample Nintendo Switch Game",
            platform: "Nintendo Switch",
            upc: code,
            marketPrice: 49.99
          });
          stopScanner();
          return;
        }
      } catch {}
      requestAnimationFrame(scan);
    };
    scan();
  } catch (e) {
    $("scanStatus").textContent = "Camera access was unavailable. Check Safari camera permissions.";
  }
});

$("closeScan").addEventListener("click", stopScanner);

function stopScanner() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  $("scanner").classList.add("hidden");
}

// Demo product for testing the full workflow.
setProduct({
  title: "Pokémon Example",
  platform: "Nintendo Switch",
  upc: "045496590770",
  marketPrice: 49.99
});
