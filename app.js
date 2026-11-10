
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* =========================================
   1. SUPABASE CONFIGURATION
========================================= */

const SUPABASE_URL = "https://rszwbyvvnpoiczyolhwd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hmkeEL-eznDDhqv2iTvYXA_asXn1O_C";

const supabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_SUPABASE") &&
  Boolean(SUPABASE_ANON_KEY);

const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const STORAGE_BUCKET = "food-images";

let foods = [];
let categories = [];
let cart = [];
let currentCategory = "All";
let editingFoodId = null;

const $ = (id) => document.getElementById(id);

const escapeHTML = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);

const money = (amount) =>
  "৳" + Number(amount || 0).toLocaleString("en-BD");

function notify(message) {
  const toast = $("toast");

  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(notify.timer);

  notify.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function requireSupabase() {
  if (!supabase) {
    notify("Supabase Configuration পরীক্ষা করো।");
    return false;
  }

  return true;
}

function setValue(id, value) {
  const element = $(id);
  if (element && value !== null && value !== undefined) {
    element.value = value;
  }
}

function setText(id, value) {
  const element = $(id);
  if (element && value !== null && value !== undefined) {
    element.textContent = value;
  }
}

/* =========================================
   2. INITIALIZATION
========================================= */

document.addEventListener("DOMContentLoaded", async () => {
  // HTML-এর admin-content-কে CSS-এর admin-panel
  // ক্লাসের সঙ্গে সামঞ্জস্য করা।
  document.querySelectorAll(".admin-content").forEach((panel) => {
    panel.classList.add("admin-panel");
  });

  setupNavigation();
  setupCart();
  setupAdmin();
  setupForms();
  setupCheckout();
  setupContactForm();
  setupPublicEvents();

  if (!requireSupabase()) {
    renderFoods();
    renderCategories();
    return;
  }

  await loadWebsite();
  await checkAdminSession();
});

/* =========================================
   3. WEBSITE DATA
========================================= */

async function loadWebsite() {
  await Promise.all([
    loadFoods(),
    loadCategories(),
    loadSettings()
  ]);
}

async function loadFoods() {
  if (!requireSupabase()) return;

  const { data, error } = await supabase
    .from("foods")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Foods:", error);
    notify("খাবারের তথ্য লোড করা যায়নি।");
    return;
  }

  foods = data || [];

  renderFoods();
  renderAdminFoods();
  updateAdminStats();
}

async function loadCategories() {
  if (!requireSupabase()) return;

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  if (error) {
    console.error("Categories:", error);
    notify("Category লোড করা যায়নি।");
    return;
  }

  categories = data || [];

  renderCategories();
  renderCategorySelect();
  renderAdminCategories();
  updateAdminStats();
}

async function loadSettings() {
  if (!requireSupabase()) return;

  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Settings:", error);
    return;
  }

  if (!data) return;

  const name = data.cafe_name || "Little Brew Café";

  // Brand information
  setText("brandName", name);
  setText("footerBrand", name);
  setText("copyrightBrand", name);
  setText("siteTitle", name);

  document.querySelectorAll(".logo").forEach((element) => {
    element.textContent = name;
  });

  // Contact information
  setText("contactAddress", data.address);
  setText("contactPhone", data.phone);
  setText("contactEmail", data.email);

  // Additional settings fields
  setValue("settingName", data.cafe_name);
  setValue("settingPhone", data.phone);
  setValue("settingEmail", data.email);
  setValue("settingAddress", data.address);
  setValue("settingAbout", data.description);
  setValue("settingHours", data.opening_hours);

  // Admin settings form
  setValue("settingWhatsapp", data.whatsapp);
  setValue("settingFacebook", data.facebook);
  setValue("settingInstagram", data.instagram);
  setValue("settingHeroImage", data.hero_image);

  // Website content
  const aboutText = $("aboutDescription");
  if (aboutText && data.description) {
    aboutText.textContent = data.description;
  }

  const heroImage = $("heroImage");
  if (heroImage && data.hero_image) {
    heroImage.src = data.hero_image;
  }
}

/* =========================================
   4. PUBLIC MENU
========================================= */

function renderFoods() {
  const grid = $("foodGrid");
  if (!grid) return;

  const search = ($("foodSearch")?.value || "")
    .trim()
    .toLowerCase();

  const filtered = foods.filter((food) => {
    const available = food.availability !== false;

    const matchesCategory =
      currentCategory === "All" ||
      food.category === currentCategory;

    const matchesSearch =
      (food.name || "").toLowerCase().includes(search) ||
      (food.description || "").toLowerCase().includes(search);

    return available && matchesCategory && matchesSearch;
  });

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-menu">
        <h3>কোনো খাবার পাওয়া যায়নি</h3>
        <p>অন্য নাম দিয়ে সার্চ করে দেখো।</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map((food) => `
    <article class="food-card">
      <div class="food-image-wrap">
        <img
          class="food-image"
          src="${escapeHTML(food.image_url || "https://placehold.co/600x400?text=Food")}"
          alt="${escapeHTML(food.name)}"
          loading="lazy"
        >

        ${food.featured
          ? '<span class="food-badge">SPECIAL</span>'
          : ""}
      </div>

      <div class="food-content">
        <h3>${escapeHTML(food.name)}</h3>
        <p>${escapeHTML(food.description || "")}</p>

        <div class="food-bottom">
          <span class="food-price">${money(food.price)}</span>

          <button
            class="add-cart-btn"
            type="button"
            data-add-cart="${escapeHTML(food.id)}"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderCategories() {
  const list = $("categoryList");
  if (!list) return;

  const names = [
    "All",
    ...categories.map((item) => item.name)
  ];

  list.innerHTML = names.map((name) => `
    <button
      type="button"
      class="category-btn ${
        currentCategory === name ? "active" : ""
      }"
      data-category="${escapeHTML(name)}"
    >
      ${escapeHTML(name)}
    </button>
  `).join("");
}

function renderCategorySelect() {
  const select = $("foodCategory");
  if (!select) return;

  const selected = select.value;

  select.innerHTML = `
    <option value="">Select Category</option>

    ${categories.map((category) => `
      <option value="${escapeHTML(category.name)}">
        ${escapeHTML(category.name)}
      </option>
    `).join("")}
  `;

  select.value = selected;
}

function setupPublicEvents() {
  $("foodSearch")?.addEventListener("input", renderFoods);

  $("foodGrid")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-cart]");
    if (!button) return;

    addToCart(button.dataset.addCart);
  });

  $("categoryList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;

    currentCategory = button.dataset.category;

    renderCategories();
    renderFoods();
  });
}

/* =========================================
   5. SHOPPING CART
========================================= */

function addToCart(foodId) {
  const food = foods.find(
    (item) => String(item.id) === String(foodId)
  );

  if (!food || food.availability === false) {
    notify("এই খাবারটি এখন পাওয়া যাচ্ছে না।");
    return;
  }

  const existing = cart.find(
    (item) => String(item.id) === String(foodId)
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: food.id,
      name: food.name,
      price: Number(food.price),
      quantity: 1
    });
  }

  renderCart();
  notify("Cart-এ খাবার যোগ হয়েছে।");
}

function changeQuantity(foodId, change) {
  const item = cart.find(
    (food) => String(food.id) === String(foodId)
  );

  if (!item) return;

  item.quantity += change;

  if (item.quantity <= 0) {
    cart = cart.filter(
      (food) => String(food.id) !== String(foodId)
    );
  }

  renderCart();
}

function renderCart() {
  const container = $("cartItems");
  const totalElement = $("cartTotal");

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  if (container) {
    container.innerHTML = cart.length
      ? cart.map((item) => `
        <div class="cart-item">
          <div>
            <h4>${escapeHTML(item.name)}</h4>
            <p>${money(item.price * item.quantity)}</p>
          </div>

          <div class="cart-quantity">
            <button
              type="button"
              data-quantity="${escapeHTML(item.id)}"
              data-change="-1"
            >−</button>

            <span>${item.quantity}</span>

            <button
              type="button"
              data-quantity="${escapeHTML(item.id)}"
              data-change="1"
            >+</button>
          </div>
        </div>
      `).join("")
      : '<p class="cart-empty">তোমার Cart এখন খালি।</p>';
  }

  if (totalElement) {
    totalElement.textContent = money(total);
  }

  const count = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const countElement = $("cartCount");

  if (countElement) {
    countElement.textContent = count;
  }

  document.querySelectorAll(".cart-count").forEach((element) => {
    element.textContent = count;
  });
}

function setupCart() {
  $("cartItems")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-quantity]");
    if (!button) return;

    changeQuantity(
      button.dataset.quantity,
      Number(button.dataset.change)
    );
  });

  // HTML ID এবং পুরোনো data attribute—দুটিই সমর্থন করবে।
  $("cartOpen")?.addEventListener("click", openCart);

  document.querySelectorAll("[data-open-cart]").forEach((button) => {
    button.addEventListener("click", openCart);
  });

  $("cartClose")?.addEventListener("click", closeCart);

  $("cartOverlay")?.addEventListener("click", (event) => {
    if (event.target.id === "cartOverlay") {
      closeCart();
    }
  });

  renderCart();
}

function openCart() {
  $("cartOverlay")?.classList.add("show");
}

function closeCart() {
  $("cartOverlay")?.classList.remove("show");
}

/* =========================================
   6. NAVIGATION
========================================= */

function setupNavigation() {
  const navigation = $("navigation") || $("navLinks");

  $("menuToggle")?.addEventListener("click", () => {
    navigation?.classList.toggle("open");
  });

  navigation?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navigation.classList.remove("open");
    });
  });
}

/* =========================================
   7. ADMIN AUTHENTICATION
========================================= */

function setupAdmin() {
  $("adminOpen")?.addEventListener("click", openAdminLogin);

  document.querySelectorAll("[data-open-admin]").forEach((button) => {
    button.addEventListener("click", openAdminLogin);
  });

  $("loginForm")?.addEventListener("submit", loginAdmin);

  $("adminLogout")?.addEventListener("click", logoutAdmin);

  $("loginClose")?.addEventListener("click", closeAdminLogin);

  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.target || tab.dataset.tab;
      if (!target) return;

      document.querySelectorAll(".admin-tab").forEach((item) => {
        item.classList.remove("active");
      });

      document.querySelectorAll(".admin-panel").forEach((panel) => {
        panel.classList.remove("active");
      });

      tab.classList.add("active");
      $(target)?.classList.add("active");
    });
  });
}

function openAdminLogin() {
  $("loginModal")?.classList.add("show");
}

function closeAdminLogin() {
  $("loginModal")?.classList.remove("show");
}

async function loginAdmin(event) {
  event.preventDefault();

  if (!requireSupabase()) return;

  const email = $("adminEmail")?.value.trim();
  const password = $("adminPassword")?.value;

  if (!email || !password) {
    notify("Email ও Password দাও।");
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error(error);
    notify("Login ব্যর্থ হয়েছে। তথ্য যাচাই করো।");
    return;
  }

  const isAdmin = await verifyAdmin();

  if (!isAdmin) {
    await supabase.auth.signOut();
    notify("এই Account Admin হিসেবে অনুমোদিত নয়।");
    return;
  }

  closeAdminLogin();
  $("adminPanel")?.classList.add("show");

  await loadAdminData();
  notify("Admin Login সফল হয়েছে।");
}

async function verifyAdmin() {
  const { data: sessionData } = await supabase.auth.getSession();

  const userId = sessionData.session?.user?.id;
  if (!userId) return false;

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Admin verification:", error);
    return false;
  }

  return Boolean(data);
}

async function checkAdminSession() {
  const { data } = await supabase.auth.getSession();

  if (!data.session) return;

  const isAdmin = await verifyAdmin();

  if (!isAdmin) {
    await supabase.auth.signOut();
    return;
  }

  $("adminPanel")?.classList.add("show");
  await loadAdminData();
}

async function logoutAdmin() {
  if (!requireSupabase()) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    notify("Logout করা যায়নি।");
    return;
  }

  $("adminPanel")?.classList.remove("show");
  notify("Admin Logout হয়েছে।");
}

/* =========================================
   8. ADMIN DASHBOARD
========================================= */

async function loadAdminData() {
  await Promise.all([
    loadFoods(),
    loadCategories(),
    loadOrders()
  ]);

  updateAdminStats();
}

function updateAdminStats() {
  const total = foods.length;

  const available = foods.filter(
    (food) => food.availability !== false
  ).length;

  const unavailable = total - available;

  setText("statTotal", total);
  setText("statAvailable", available);
  setText("statUnavailable", unavailable);
  setText("statCategories", categories.length);

  // পুরোনো HTML ID-ও সমর্থন করবে।
  setText("totalFoods", total);
  setText("availableFoods", available);
  setText("totalCategories", categories.length);
}

/* =========================================
   9. ADMIN FORMS
========================================= */

function setupForms() {
  $("foodForm")?.addEventListener("submit", saveFood);

  $("categoryForm")?.addEventListener("submit", saveCategory);

  $("settingsForm")?.addEventListener("submit", saveSettings);

  $("adminFoodList")?.addEventListener("click", handleFoodActions);

  $("adminCategoryList")?.addEventListener("click", handleCategoryActions);
}

/* =========================================
   10. FOOD IMAGE UPLOAD
========================================= */

async function uploadFoodImage(file) {
  if (!file) return null;

  if (!file.type.startsWith("image/")) {
    throw new Error("শুধু Image ফাইল আপলোড করা যাবে।");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("ছবির সাইজ ৫ MB-এর কম হতে হবে।");
  }

  const extension = file.name.split(".").pop().toLowerCase();
  const fileName = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return data.publicUrl;
}

/* =========================================
   11. SAVE FOOD
========================================= */

async function saveFood(event) {
  event.preventDefault();

  if (!requireSupabase()) return;

  const form = event.currentTarget;

  const name = $("foodName")?.value.trim();
  const price = Number($("foodPrice")?.value);
  const category = $("foodCategory")?.value;
  const description = $("foodDescription")?.value.trim();

  // HTML-এ availability একটি SELECT।
  const availability =
    $("foodAvailability")?.value === "true";

  const featured = Boolean($("foodFeatured")?.checked);
  const imageFile = $("foodImage")?.files?.[0];

  if (!name || !category || !Number.isFinite(price) || price < 0) {
    notify("খাবারের নাম, সঠিক দাম ও Category দাও।");
    return;
  }

  try {
    let imageUrl = null;

    if (imageFile) {
      imageUrl = await uploadFoodImage(imageFile);
    }

    const payload = {
      name,
      price,
      category,
      description,
      availability,
      featured
    };

    if (imageUrl) {
      payload.image_url = imageUrl;
    }

    let result;

    if (editingFoodId) {
      result = await supabase
        .from("foods")
        .update(payload)
        .eq("id", editingFoodId);
    } else {
      if (!imageUrl) {
        payload.image_url =
          "https://placehold.co/600x400?text=Food";
      }

      result = await supabase
        .from("foods")
        .insert(payload);
    }

    if (result.error) throw result.error;

    form.reset();
    editingFoodId = null;

    const submitButton = form.querySelector('[type="submit"]');

    if (submitButton) {
      submitButton.textContent = "Save Food";
    }

    await loadFoods();

    notify("খাবারের তথ্য সংরক্ষণ হয়েছে।");

  } catch (error) {
    console.error(error);
    notify(error.message || "খাবার সংরক্ষণ করা যায়নি।");
  }
}

/* =========================================
   12. ADMIN FOOD TABLE
========================================= */

function renderAdminFoods() {
  const table = $("adminFoodList");
  if (!table) return;

  table.innerHTML = foods.length
    ? foods.map((food) => `
      <tr>
        <td>
          <img
            src="${escapeHTML(food.image_url || "")}"
            alt="${escapeHTML(food.name)}"
          >
        </td>

        <td>${escapeHTML(food.name)}</td>
        <td>${escapeHTML(food.category)}</td>
        <td>${money(food.price)}</td>

        <td>
          <span class="status-badge ${
            food.availability
              ? "status-available"
              : "status-unavailable"
          }">
            ${food.availability ? "Available" : "Unavailable"}
          </span>
        </td>

        <td>
          <button
            class="admin-action edit-btn"
            data-edit-food="${escapeHTML(food.id)}"
          >Edit</button>

          <button
            class="admin-action delete-btn"
            data-delete-food="${escapeHTML(food.id)}"
          >Delete</button>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="6">কোনো খাবার যোগ করা হয়নি।</td></tr>';
}

function handleFoodActions(event) {
  const editButton = event.target.closest("[data-edit-food]");
  const deleteButton = event.target.closest("[data-delete-food]");

  if (editButton) editFood(editButton.dataset.editFood);

  if (deleteButton) deleteFood(deleteButton.dataset.deleteFood);
}

function editFood(foodId) {
  const food = foods.find(
    (item) => String(item.id) === String(foodId)
  );

  if (!food) return;

  editingFoodId = food.id;

  setValue("foodName", food.name);
  setValue("foodPrice", food.price);
  setValue("foodCategory", food.category);
  setValue("foodDescription", food.description);

  // SELECT-এর value সেট করতে হবে, checked নয়।
  setValue(
    "foodAvailability",
    food.availability === false ? "false" : "true"
  );

  if ($("foodFeatured")) {
    $("foodFeatured").checked = Boolean(food.featured);
  }

  const button = $("foodForm")?.querySelector('[type="submit"]');

  if (button) {
    button.textContent = "Update Food";
  }

  $("foodForm")?.scrollIntoView({ behavior: "smooth" });
}

async function deleteFood(foodId) {
  if (!confirm("এই খাবারটি Delete করতে চাও?")) return;
  if (!requireSupabase()) return;

  const { error } = await supabase
    .from("foods")
    .delete()
    .eq("id", foodId);

  if (error) {
    console.error(error);
    notify("খাবার Delete করা যায়নি।");
    return;
  }

  await loadFoods();
  notify("খাবার Delete হয়েছে।");
}

/* =========================================
   13. CATEGORY MANAGEMENT
========================================= */

async function saveCategory(event) {
  event.preventDefault();

  if (!requireSupabase()) return;

  const form = event.currentTarget;

  const input =
    $("newCategoryName") ||
    form.querySelector("input");

  const name = input?.value.trim();

  if (!name) {
    notify("Category-এর নাম লিখো।");
    return;
  }

  const { error } = await supabase
    .from("categories")
    .insert({ name });

  if (error) {
    console.error(error);
    notify("Category যোগ করা যায়নি।");
    return;
  }

  form.reset();

  await loadCategories();

  notify("নতুন Category যোগ হয়েছে।");
}

function renderAdminCategories() {
  const list = $("adminCategoryList");
  if (!list) return;

  list.innerHTML = categories.length
    ? categories.map((category) => `
      <div class="cart-item">
        <strong>${escapeHTML(category.name)}</strong>

        <button
          class="admin-action delete-btn"
          data-delete-category="${escapeHTML(category.id)}"
        >
          Delete
        </button>
      </div>
    `).join("")
    : "<p>কোনো Category নেই।</p>";
}

function handleCategoryActions(event) {
  const button = event.target.closest("[data-delete-category]");
  if (!button) return;

  deleteCategory(button.dataset.deleteCategory);
}

async function deleteCategory(categoryId) {
  if (!confirm("এই Category Delete করতে চাও?")) return;

  const category = categories.find(
    (item) => String(item.id) === String(categoryId)
  );

  if (!category) return;

  const hasFoods = foods.some(
    (food) => food.category === category.name
  );

  if (hasFoods) {
    notify("আগে এই Category-এর খাবারগুলো অন্য Category-তে সরাও বা Delete করো।");
    return;
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId);

  if (error) {
    console.error(error);
    notify("Category Delete করা যায়নি।");
    return;
  }

  await loadCategories();
  notify("Category Delete হয়েছে।");
}

/* =========================================
   14. WEBSITE SETTINGS
========================================= */

async function saveSettings(event) {
  event.preventDefault();

  if (!requireSupabase()) return;

  // HTML-এর প্রকৃত ID থেকে তথ্য নেওয়া হচ্ছে।
  const payload = {
    cafe_name: $("settingName")?.value.trim() || "",
    phone: $("settingPhone")?.value.trim() || "",
    email: $("settingEmail")?.value.trim() || "",
    address: $("settingAddress")?.value.trim() || "",
    description: $("settingAbout")?.value.trim() || "",
    opening_hours: $("settingHours")?.value.trim() || ""
  };

  // অতিরিক্ত কলাম থাকলেই সেগুলো পাঠানো হবে।
  // Database-এ কলাম না থাকলে আলাদা করে SQL-এ যোগ করতে হবে।
  const { data: existing, error: readError } = await supabase
    .from("site_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (readError) {
    console.error(readError);
    notify("Settings লোড করা যায়নি।");
    return;
  }

  let result;

  if (existing) {
    result = await supabase
      .from("site_settings")
      .update(payload)
      .eq("id", existing.id);
  } else {
    result = await supabase
      .from("site_settings")
      .insert(payload);
  }

  if (result.error) {
    console.error(result.error);
    notify("Settings Save করা যায়নি।");
    return;
  }

  await loadSettings();
  notify("Website Settings Update হয়েছে।");
}

/* =========================================
   15. CHECKOUT
========================================= */

function setupCheckout() {
  const checkoutButton = $("checkoutBtn") || $("checkoutButton");

  checkoutButton?.addEventListener("click", () => {
    if (!cart.length) {
      notify("তোমার Cart খালি।");
      return;
    }

    closeCart();
    $("checkoutModal")?.classList.add("show");
  });

  $("checkoutForm")?.addEventListener("submit", placeOrder);

  $("checkoutClose")?.addEventListener("click", () => {
    $("checkoutModal")?.classList.remove("show");
  });
}

async function placeOrder(event) {
  event.preventDefault();

  if (!requireSupabase()) return;

  if (!cart.length) {
    notify("Cart খালি।");
    return;
  }

  const customerName = $("orderCustomer")?.value.trim();
  const phone = $("orderPhone")?.value.trim();
  const address = $("orderAddress")?.value.trim();

  if (!customerName || !phone || !address) {
    notify("নাম, ফোন ও ঠিকানা পূরণ করো।");
    return;
  }

  const orderPayload = {
    customer_name: customerName,
    phone,
    address,
    items: cart.map((item) => ({
      food_id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    })),
    total: cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    ),
    status: "Pending"
  };

  const { error } = await supabase
    .from("orders")
    .insert(orderPayload);

  if (error) {
    console.error(error);
    notify("Order করা যায়নি। আবার চেষ্টা করো।");
    return;
  }

  cart = [];
  renderCart();

  $("checkoutForm")?.reset();
  $("checkoutModal")?.classList.remove("show");

  notify("তোমার Order গ্রহণ করা হয়েছে।");

  await loadOrders();
}

/* =========================================
   16. ORDER MANAGEMENT
========================================= */

async function loadOrders() {
  if (!requireSupabase()) return;

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Orders:", error);
    return;
  }

  renderOrders(data || []);
}

function renderOrders(orders) {
  const table = $("adminOrderList");
  if (!table) return;

  table.innerHTML = orders.length
    ? orders.map((order) => `
      <tr>
        <td>${escapeHTML(String(order.id).slice(0, 8))}</td>
        <td>${escapeHTML(order.customer_name)}</td>
        <td>${escapeHTML(order.phone)}</td>
        <td>${money(order.total)}</td>
        <td>${escapeHTML(order.status || "Pending")}</td>

        <td>
          <select data-order-status="${escapeHTML(order.id)}">
            ${["Pending", "Accepted", "Preparing", "Completed", "Cancelled"]
              .map((status) => `
                <option
                  value="${status}"
                  ${order.status === status ? "selected" : ""}
                >
                  ${status}
                </option>
              `).join("")}
          </select>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="6">এখনো কোনো Order নেই।</td></tr>';
}

$("adminOrderList")?.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-order-status]");

  if (!select || !requireSupabase()) return;

  const { error } = await supabase
    .from("orders")
    .update({ status: select.value })
    .eq("id", select.dataset.orderStatus);

  if (error) {
    console.error(error);
    notify("Order Status পরিবর্তন করা যায়নি।");
    return;
  }

  notify("Order Status Update হয়েছে।");
});

/* =========================================
   17. CONTACT FORM
========================================= */

function setupContactForm() {
  $("contactForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const form = event.currentTarget;

    // এটি বর্তমানে শুধু form submission confirmation।
    // বাস্তব Email পাঠাতে Backend Email Service প্রয়োজন।

    notify("ধন্যবাদ! Contact Form পূরণ হয়েছে।");
    form.reset();
  });
}

/* =========================================
   18. GLOBAL BUTTON SUPPORT
========================================= */

window.openAdminLogin = openAdminLogin;
window.closeAdminLogin = closeAdminLogin;
window.openCart = openCart;
window.closeCart = closeCart;
window.logoutAdmin = logoutAdmin;
window.loadWebsite = loadWebsite;
window.renderFoods = renderFoods;
