const shipping = 5.00;
let product = null;
let stream = null;

const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD"}).format(n);

function setProduct(p, note="") {
  product = p;
  $("productTitle").textContent = p.title || "Unknown product";
  $("platform").textContent = p.platform || "Platform not identified";
  $("upc").textContent = p.upc || "";
  $("marketPrice").textContent = money(p.marketPrice || 0);
  $("marketNote").textContent = note;
  $("productCard").classList.remove("hidden");
  $("dealCard").classList.remove("hidden");
  calculate();
}

function calculate() {
  if (!product) return;
  const market = Number(product.marketPrice) || 0;
  const cost = Number($("cost").value);
  const feeRate = Number($("feeRate").value);
  const targetROI = Number($("targetRoi").value) / 100;

  const fees = market * feeRate;
  const net = Math.max(0, market - fees - shipping);
  const maxBuy = net / (1 + targetROI);

  $("fees").textContent = money(fees);
  $("shipping").textContent = money(shipping);
  $("net").textContent = money(net);
  $("maxBuy").textContent = money(maxBuy);

  if (!(cost > 0)) {
    $("profit").textContent = "$0.00";
    $("roi").textContent = "0%";
    $("verdict").textContent = "Enter your purchase price";
    $("verdict").className = "verdict neutral";
    return;
  }

  const profit = net - cost;
  const roi = cost ? (profit / cost) * 100 : 0;
  $("profit").textContent = money(profit);
  $("roi").textContent = `${roi.toFixed(0)}%`;

  let text, cls;
  if (cost <= maxBuy) { text = "🟢 BUY"; cls = "buy"; }
  else if (roi >= 25) { text = "🟡 MAYBE"; cls = "maybe"; }
  else if (roi >= 0) { text = "🟠 LOW MARGIN"; cls = "low"; }
  else { text = "🔴 PASS"; cls = "pass"; }

  $("verdict").textContent = text;
  $("verdict").className = `verdict ${cls}`;
}

async function lookupUPC(upc) {
  upc = String(upc).replace(/\D/g, "");
  if (!upc) return;
  $("scanStatus").textContent = "Looking up UPC…";
  try {
    const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(upc)}`;
    const response = await fetch(url, {headers: {"Accept":"application/json"}});
    const data = await response.json();
    if (!response.ok || !data.items || !data.items.length) {
      throw new Error(data.message || "UPC not found");
    }

    const item = data.items[0];
    const title = item.title || "Unknown product";
    const category = item.category || "";
    const brand = item.brand || "";

    // Prototype only: keep market price separate from product identity.
    // We use the first usable non-eBay/non-Amazon offer as a temporary reference.
    const offers = Array.isArray(item.offers) ? item.offers : [];
    const usable = offers.filter(o => Number(o.price) > 0);
    const prices = usable.map(o => Number(o.price)).filter(Number.isFinite);
    const referencePrice = prices.length ? prices.sort((a,b)=>a-b)[Math.floor(prices.length/2)] : 0;

    const note = referencePrice
      ? `UPC identified live. Temporary reference price from available non-marketplace offers: ${money(referencePrice)}.`
      : "UPC identified live. No usable reference offer returned.";

    setProduct({
      title,
      platform: category || "Product",
      upc: item.upc || upc,
      marketPrice: referencePrice
    }, note);

    $("scanStatus").textContent = brand ? `Found: ${brand}` : "UPC found";
  } catch (err) {
    $("scanStatus").textContent = `Lookup failed: ${err.message}. Try another UPC or enter it again.`;
  }
}

$("cost").addEventListener("input", calculate);
$("targetRoi").addEventListener("change", calculate);
$("feeRate").addEventListener("change", calculate);

$("lookupBtn").addEventListener("click", () => lookupUPC($("manualUpc").value));
$("manualUpc").addEventListener("keydown", e => {
  if (e.key === "Enter") lookupUPC($("manualUpc").value);
});

$("scanBtn").addEventListener("click", async () => {
  const scanner = $("scanner");
  scanner.classList.remove("hidden");
  $("scanStatus").textContent = "";

  try {
    if (!("BarcodeDetector" in window)) {
      $("scanStatus").textContent = "Live barcode detection isn't supported here. Enter the UPC manually for now.";
      return;
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {facingMode: {ideal: "environment"}}
    });
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
          stopScanner();
          await lookupUPC(code);
          return;
        }
      } catch {}
      requestAnimationFrame(scan);
    };
    scan();
  } catch {
    $("scanStatus").textContent = "Camera access was unavailable. Check Safari camera permissions.";
  }
});

$("closeScan").addEventListener("click", stopScanner);

function stopScanner() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  $("scanner").classList.add("hidden");
}

// Keep a sample loaded so the calculator can be tested immediately.
setProduct({
  title: "Pokémon Example",
  platform: "Nintendo Switch",
  upc: "045496590770",
  marketPrice: 49.99
}, "Sample data. Use SCAN UPC or enter a real UPC to test live product identification.");
