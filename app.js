const shipping = 5.00;
let product = null;
let stream = null;

const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD"}).format(n);

function renderListings(listings = []) {
  const grid = $("listingGrid");
  $("listingCount").textContent = listings.length;
  grid.innerHTML = "";

  listings.forEach((listing, index) => {
    const card = document.createElement(listing.url ? "a" : "div");
    card.className = "listing";
    if (listing.url) {
      card.href = listing.url;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
    }

    const image = document.createElement("img");
    image.className = "listingImage";
    image.alt = listing.title || `eBay listing ${index + 1}`;
    image.loading = "lazy";
    if (listing.imageUrl) {
      image.src = listing.imageUrl;
      image.onerror = () => {
        image.removeAttribute("src");
        image.classList.add("empty");
        image.alt = "Photo unavailable";
        image.textContent = "Photo unavailable";
      };
    } else {
      image.classList.add("empty");
      image.alt = "Photo unavailable";
      image.textContent = "Photo unavailable";
    }

    const info = document.createElement("div");
    info.className = "listingInfo";
    const title = document.createElement("div");
    title.className = "listingTitle";
    title.textContent = listing.title || "eBay listing";
    info.appendChild(title);

    if (listing.condition) {
      const condition = document.createElement("div");
      condition.className = "listingCondition";
      condition.textContent = listing.condition;
      info.appendChild(condition);
    }

    const price = document.createElement("div");
    price.className = "listingPrice";
    price.textContent = money(listing.price || 0);

    card.append(image, info, price);
    grid.appendChild(card);
  });
}

function setProduct(p, note="") {
  product = p;
  $("productTitle").textContent = p.title || "Unknown product";
  $("platform").textContent = p.platform || "Category not identified";
  $("upc").textContent = p.upc || "";
  $("marketPrice").textContent = money(p.marketPrice || 0);
  $("marketNote").textContent = note;
  renderListings(p.listings || []);
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
  const roi = (profit / cost) * 100;
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

async function analyzeUPC(upc) {
  upc = String(upc).replace(/\D/g, "");
  if (!upc) return;
  $("scanStatus").textContent = "Analyzing product…";
  try {
    const response = await fetch(`/api/analyze?upc=${encodeURIComponent(upc)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Server lookup failed");

    setProduct({
      title: data.product.title,
      platform: data.product.category || "Product",
      upc: data.product.upc || upc,
      marketPrice: data.market.referencePrice,
      listings: data.market.listings || []
    }, data.market.note);

    $("scanStatus").textContent = `Found ${data.market.sampleSize} eBay listings.`;
  } catch (err) {
    $("scanStatus").textContent = `Analysis failed: ${err.message}`;
  }
}

$("cost").addEventListener("input", calculate);
$("targetRoi").addEventListener("change", calculate);
$("feeRate").addEventListener("change", calculate);

$("lookupBtn").addEventListener("click", () => analyzeUPC($("manualUpc").value));
$("manualUpc").addEventListener("keydown", e => {
  if (e.key === "Enter") analyzeUPC($("manualUpc").value);
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
          stopScanner();
          $("manualUpc").value = code;
          await analyzeUPC(code);
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
