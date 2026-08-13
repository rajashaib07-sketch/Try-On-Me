const productGrid = document.getElementById("productGrid");
const selectedProduct = document.getElementById("selectedProduct");
const selectedProductImg = document.getElementById("selectedProductImg");
const selectedProductName = document.getElementById("selectedProductName");
const selectedProductPrice = document.getElementById("selectedProductPrice");

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const dropzoneEmpty = document.getElementById("dropzoneEmpty");
const photoPreview = document.getElementById("photoPreview");
const resultPreview = document.getElementById("resultPreview");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");

const changePhotoBtn = document.getElementById("changePhotoBtn");
const tryOnBtn = document.getElementById("tryOnBtn");
const errorMsg = document.getElementById("errorMsg");

let products = [];
let selectedProductId = null;
let userPhotoDataUrl = null;

const LOADING_MESSAGES = [
  "Scanning garment details…",
  "Matching fit to your photo…",
  "Rendering your preview…"
];

// ---------------- product grid ----------------

async function loadProducts() {
  const res = await fetch("/api/products");
  products = await res.json();

  productGrid.innerHTML = products
    .map(
      (p) => `
      <button class="product-card" data-id="${p.id}" type="button">
        <img src="${p.image}" alt="${p.name}" loading="lazy" />
        <div class="product-card__name">${p.name}</div>
        <div class="product-card__price">${p.price}</div>
      </button>`
    )
    .join("");

  productGrid.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => selectProduct(card.dataset.id));
  });

  // auto-select the first product so the demo works with one click
  if (products.length) selectProduct(products[0].id);
}

function selectProduct(id) {
  selectedProductId = id;
  const product = products.find((p) => p.id === id);
  if (!product) return;

  productGrid.querySelectorAll(".product-card").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.id === id);
  });

  selectedProduct.hidden = false;
  selectedProductImg.src = product.image;
  selectedProductName.textContent = product.name;
  selectedProductPrice.textContent = product.price;

  updateTryOnButton();
}

// ---------------- photo upload ----------------

dropzone.addEventListener("click", () => {
  if (!resultPreview.hidden) return; // don't reopen picker over a result
  fileInput.click();
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) handlePhotoFile(file);
});

["dragover", "dragenter"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("is-dragover");
  })
);

["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-dragover");
  })
);

dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handlePhotoFile(file);
});

function handlePhotoFile(file) {
  if (!file.type.startsWith("image/")) {
    showError("Please upload a JPG, PNG, or WEBP image.");
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    showError("That photo is over 15\u00a0MB — please use a smaller file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    userPhotoDataUrl = reader.result;
    dropzoneEmpty.hidden = true;
    resultPreview.hidden = true;
    photoPreview.hidden = false;
    photoPreview.src = userPhotoDataUrl;
    changePhotoBtn.hidden = false;
    clearError();
    updateTryOnButton();
  };
  reader.readAsDataURL(file);
}

changePhotoBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  userPhotoDataUrl = null;
  photoPreview.hidden = true;
  resultPreview.hidden = true;
  dropzoneEmpty.hidden = false;
  changePhotoBtn.hidden = true;
  fileInput.value = "";
  updateTryOnButton();
});

// ---------------- try-on ----------------

function updateTryOnButton() {
  tryOnBtn.disabled = !(selectedProductId && userPhotoDataUrl);
}

tryOnBtn.addEventListener("click", runTryOn);

async function runTryOn() {
  clearError();
  setLoading(true);

  try {
    const res = await fetch("/api/tryon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: selectedProductId, photo: userPhotoDataUrl })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Try-on failed. Please try again.");

    photoPreview.hidden = true;
    resultPreview.hidden = false;
    resultPreview.src = data.image;
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  loadingOverlay.hidden = !isLoading;
  tryOnBtn.disabled = isLoading || !(selectedProductId && userPhotoDataUrl);
  tryOnBtn.textContent = isLoading ? "✦ Stitching…" : "✦ Stitch on me";

  if (isLoading) {
    let i = 0;
    loadingText.textContent = LOADING_MESSAGES[0];
    tryOnBtn._interval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      loadingText.textContent = LOADING_MESSAGES[i];
    }, 1600);
  } else {
    clearInterval(tryOnBtn._interval);
  }
}

function showError(message) {
  errorMsg.hidden = false;
  errorMsg.textContent = message;
}
function clearError() {
  errorMsg.hidden = true;
  errorMsg.textContent = "";
}

loadProducts();
