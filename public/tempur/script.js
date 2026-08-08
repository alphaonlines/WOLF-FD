const shopUrl = "https://www.furnituredistributors.net/Brands/TempurSealy?s=1&pgmark=1";

const models = {
  adapt: {
    label: "TEMPUR-Adapt®",
    badge: "Legendary",
    badgeCopy: "pressure relief",
    profile: "11 inches",
    cover: "Cool-to-the-touch",
    feels: "Medium · Medium Hybrid",
    image: "assets/adapt-room.jpg",
    alt: "TEMPUR-Adapt mattress in a styled bedroom",
  },
  proadapt: {
    label: "TEMPUR-ProAdapt®",
    badge: "Advanced",
    badgeCopy: "pressure relief",
    profile: "12 inches",
    cover: "Cool-to-the-touch · Removable · Washable",
    feels: "Soft · Medium · Medium Hybrid · Firm",
    image: "assets/proadapt-room.jpg",
    alt: "TEMPUR-ProAdapt mattress in a styled bedroom",
  },
  luxebreeze: {
    label: "TEMPUR-LuxeBreeze®",
    badge: "Coolest",
    badgeCopy: "all-night cooling",
    profile: "13 inches",
    cover: "Cool-to-the-touch · Removable · Washable",
    feels: "Soft · Medium Hybrid · Firm",
    image: "assets/luxebreeze-room.jpg",
    alt: "TEMPUR-LuxeBreeze mattress in a styled bedroom",
  },
};

const choices = Array.from(document.querySelectorAll("[data-model]"));
const gallery = document.querySelector(".hero-gallery");
const heroImage = document.querySelector("#hero-image");
const selectedModel = document.querySelector("#hero-selected-model");
const badge = document.querySelector("#hero-badge");
const badgeCopy = document.querySelector("#hero-badge-copy");
const profile = document.querySelector("#detail-profile");
const cover = document.querySelector("#detail-cover");
const feels = document.querySelector("#detail-feels");

function selectModel(key, shouldScroll = false) {
  const model = models[key];
  if (!model || !heroImage) return;
  choices.forEach((choice) => {
    const active = choice.dataset.model === key;
    choice.classList.toggle("is-active", active);
    choice.setAttribute("aria-pressed", String(active));
  });
  gallery.classList.add("is-changing");
  heroImage.src = model.image;
  heroImage.alt = model.alt;
  selectedModel.textContent = model.label;
  badge.textContent = model.badge;
  badgeCopy.textContent = model.badgeCopy;
  profile.textContent = model.profile;
  cover.textContent = model.cover;
  feels.textContent = model.feels;
  window.setTimeout(() => gallery.classList.remove("is-changing"), 220);
  if (shouldScroll) document.querySelector(".product-hero").scrollIntoView({ behavior: "smooth", block: "start" });
  if (typeof window.gtag === "function") window.gtag("event", "tempur_model_select", { model: key });
}

choices.forEach((choice, index) => {
  choice.addEventListener("click", () => selectModel(choice.dataset.model));
  choice.addEventListener("keydown", (event) => {
    if (!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const next = choices[(index + (forward ? 1 : -1) + choices.length) % choices.length];
    next.focus(); selectModel(next.dataset.model);
  });
});

document.querySelectorAll("[data-model-jump]").forEach((button) => {
  button.addEventListener("click", () => selectModel(button.dataset.modelJump, true));
});

document.querySelectorAll("[data-shop-link]").forEach((link) => {
  link.href = shopUrl;
  link.addEventListener("click", () => {
    if (typeof window.gtag === "function") window.gtag("event", "tempur_shop_click", { destination: shopUrl });
  });
});

selectModel("proadapt");
