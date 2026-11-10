
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* =========================================
   1. SUPABASE CONFIGURATION
========================================= */

// Supabase Dashboard থেকে এগুলো সংগ্রহ করবে।
const SUPABASE_URL = "https://rszwbyvvnpoiczyolhwd.supabase.co";
const SUPABASE_ANON_KEY = "sb\_publishable\_hmkeEL-eznDDhqv2iTvYXA\_asXn1O\_C";

const supabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_SUPABASE");

const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const STORAGE_BUCKET = "food-images";

/* =========================================
   2. APPLICATION STATE
========================================= */

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
    notify("প্রথমে app.js-এ Supabase URL ও Key বসাও।");
    return false;
  }
  return true;
}

/* =========================================
   3. INITIALIZATION
========================================= */

document.addEventListener("DOMContentLoaded", async () => {
  setupNavigation();
  setupCart();
  setupAdmin();
  setupForms();
  setupCheckout();
  setupContactForm();

  if (requireSupabase()) {
    await loadWebsite();
    await checkAdminSession();
  } else {
    renderFoods();
    renderCategories();
  }
});

/* =========================================
   4. LOAD WEBSITE DATA
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
}

async function loadCategories() {
  if (!requireSupabase()) return;

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  if (error) {
    console.error("Categories:", error);
    return;
  }

  categories = data || [];
  renderCategories();
  renderCategorySelect();
  renderAdminCategories();
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

  document.querySelectorAll(".logo").forEach((element) => {
    element.textContent = name;
  });

  const title = $("siteTitle");
  if (title) title.textContent = name;

  const address = $("contactAddress");
  if (address && data.address) address.textContent = data.address;

  const phone = $("contactPhone");
  if (phone && data.phone) phone.textContent = data.phone;

  const email = $("contactEmail");
  if (email && data.email) email.textContent = data.email;

  const form = $("settingsForm");
  if (form) {
    setFormValue(form, "cafe_name", data.cafe_name);
    setFormValue(form, "address", data.address);
    setFormValue(form, "phone", data.phone);
    setFormValue(form, "email", data.email);
    setFormValue(form, "opening_hours", data.opening_hours);
    setFormValue(form, "description", data.description);
  }
}

function setFormValue(form, name, value) {
  const field = form.elements.namedItem(name);
  if (field && value != null) field.value = value;
}

/* =========================================
   5. PUBLIC FOOD MENU
========================================= */

function renderFoods() {
  const grid = $("foodGrid");
  if (!grid) return;

  const search = ($("foodSearch")?.value || "").toLowerCase();

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
      </div>`;
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
        ${food.featured ? '<span class="food-badge">SPECIAL</span>' : ""}
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

  const names = ["All", ...categories.map((item) => item.name)];

  list.innerHTML = names.map((name) => `
    <button
      type="button"
      class="category-btn ${currentCategory === name ? "active" : ""}"
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

/* =========================================
   6. SHOPPING CART
========================================= */

function addToCart(foodId) {
  const food = foods.find((item) => String(item.id) === String(foodId));

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
            <button type="button" data-quantity="${escapeHTML(item.id)}" data-change="-1">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-quantity="${escapeHTML(item.id)}" data-change="1">+</button>
          </div>
        </div>
      `).join("")
      : '<p class="cart-empty">তোমার Cart এখন খালি।</p>';
  }

  if (totalElement) totalElement.textContent = money(total);

  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
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

  document.querySelectorAll("[data-open-cart]").forEach((button) => {
    button.addEventListener("click", openCart);
  });

  $("cartClose")?.addEventListener("click", closeCart);

  $("cartOverlay")?.addEventListener("click", (event) => {
    if (event.target.id === "cartOverlay") closeCart();
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
   7. NAVIGATION
========================================= */

function setupNavigation() {
  $("menuToggle")?.addEventListener("click", () => {
    $("navLinks")?.classList.toggle("open");
  });

  $("navLinks")?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      $("navLinks")?.classList.remove("open");
    });
  });
}

/* =========================================
   8. ADMIN LOGIN & AUTHENTICATION
========================================= */

function setupAdmin() {
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

  closeAdminLogin();
  $("adminPanel")?.classList.add("show");

  await loadAdminData();
  notify("Admin Login সফল হয়েছে।");
}

async function checkAdminSession() {
  const { data } = await supabase.auth.getSession();

  if (data.session) {
    $("adminPanel")?.classList.add("show");
    await loadAdminData();
  }
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
   9. ADMIN DATA
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
  const totalFoods = $("totalFoods");
  const availableFoods = $("availableFoods");
  const totalCategories = $("totalCategories");

  if (totalFoods) totalFoods.textContent = foods.length;

  if (availableFoods) {
    availableFoods.textContent =
      foods.filter((food) => food.availability !== false).length;
  }

  if (totalCategories) {
    totalCategories.textContent = categories.length;
  }
}

/* =========================================
   10. ADD / EDIT FOOD
========================================= */

function setupForms() {
  $("foodForm")?.addEventListener("submit", saveFood);

  $("categoryForm")?.addEventListener("submit", saveCategory);

  $("settingsForm")?.addEventListener("submit", saveSettings);

  $("adminFoodList")?.addEventListener("click", handleFoodActions);

  $("adminCategoryList")?.addEventListener("click", handleCategoryActions);
}

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

async function saveFood(event) {
  event.preventDefault();

  if (!requireSupabase()) return;

  const form = event.currentTarget;
  const name = $("foodName")?.value.trim();
  const price = Number($("foodPrice")?.value);
  const category = $("foodCategory")?.value;
  const description = $("foodDescription")?.value.trim();
  const availability = $("foodAvailability")?.checked ?? true;
  const featured = $("foodFeatured")?.checked ?? false;
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

    if (imageUrl) payload.image_url = imageUrl;

    let result;

    if (editingFoodId) {
      result = await supabase
        .from("foods")
        .update(payload)
        .eq("id", editingFoodId);
    } else {
      if (!imageUrl) {
        payload.image_url = "https://placehold.co/600x400?text=Food";
      }

      result = await supabase
        .from("foods")
        .insert(payload);
    }

    if (result.error) throw result.error;

    form.reset();
    editingFoodId = null;

    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.textContent = "Save Food";

    await loadFoods();
    updateAdminStats();

    notify("খাবারের তথ্য সংরক্ষণ হয়েছে।");

  } catch (error) {
    console.error(error);
    notify(error.message || "খাবার সংরক্ষণ করা যায়নি।");
  }
}

function renderAdminFoods() {
  const table = $("adminFoodList");
  if (!table) return;

  table.innerHTML = foods.length
    ? foods.map((food) => `
      <tr>
        <td>
          <img src="${escapeHTML(food.image_url || "")}" alt="">
        </td>
        <td>${escapeHTML(food.name)}</td>
        <td>${money(food.price)}</td>
        <td>${escapeHTML(food.category)}</td>
        <td>
          <span class="status-badge ${
            food.availability ? "status-available" : "status-unavailable"
          }">
            ${food.availability ? "Available" : "Unavailable"}
          </span>
        </td>
        <td>
          <button class="admin-action edit-btn" data-edit-food="${escapeHTML(food.id)}">Edit</button>
          <button class="admin-action delete-btn" data-delete-food="${escapeHTML(food.id)}">Delete</button>
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

  $("foodName").value = food.name || "";
  $("foodPrice").value = food.price || "";
  $("foodCategory").value = food.category || "";
  $("foodDescription").value = food.description || "";

  if ($("foodAvailability")) {
    $("foodAvailability").checked = food.availability !== false;
  }

  if ($("foodFeatured")) {
    $("foodFeatured").checked = Boolean(food.featured);
  }

  const button = $("foodForm")?.querySelector('[type="submit"]');
  if (button) button.textContent = "Update Food";

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
  updateAdminStats();
  notify("খাবার Delete হয়েছে।");
}

/* =========================================
   11. CATEGORY MANAGEMENT
========================================= */

async function saveCategory(event) {
  event.preventDefault();

  if (!requireSupabase()) return;

  const form = event.currentTarget;
  const input =
    form.querySelector('[name="category_name"]') ||
    form.querySelector('input');

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
  updateAdminStats();

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
  updateAdminStats();
  notify("Category Delete হয়েছে।");
}

/* =========================================
   12. WEBSITE SETTINGS
========================================= */

async function saveSettings(event) {
  event.preventDefault();

  if (!requireSupabase()) return;

  const form = event.currentTarget;
  const formData = new FormData(form);

  const payload = {
    cafe_name: formData.get("cafe_name")?.toString().trim() || "",
    address: formData.get("address")?.toString().trim() || "",
    phone: formData.get("phone")?.toString().trim() || "",
    email: formData.get("email")?.toString().trim() || "",
    opening_hours: formData.get("opening_hours")?.toString().trim() || "",
    description: formData.get("description")?.toString().trim() || ""
  };

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
   13. CHECKOUT & ORDER MANAGEMENT
========================================= */

function setupCheckout() {
  $("checkoutButton")?.addEventListener("click", () => {
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

  const form = event.currentTarget;
  const formData = new FormData(form);

  const customerName =
    formData.get("customer_name") ||
    form.querySelector('[name="name"]')?.value;

  const phone =
    formData.get("phone") ||
    form.querySelector('[name="phone"]')?.value;

  const address =
    formData.get("address") ||
    form.querySelector('[name="address"]')?.value;

  if (!customerName || !phone || !address) {
    notify("নাম, ফোন ও ঠিকানা পূরণ করো।");
    return;
  }

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const orderPayload = {
    customer_name: String(customerName).trim(),
    phone: String(phone).trim(),
    address: String(address).trim(),
    items: cart.map((item) => ({
      food_id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    })),
    total,
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
  form.reset();

  $("checkoutModal")?.classList.remove("show");

  notify("তোমার Order গ্রহণ করা হয়েছে।");

  await loadOrders();
}

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
        <td>${escapeHTML(order.customer_name)}</td>
        <td>${escapeHTML(order.phone)}</td>
        <td>${money(order.total)}</td>
        <td>${escapeHTML(order.status || "Pending")}</td>
        <td>
          <select data-order-status="${escapeHTML(order.id)}">
            ${["Pending", "Accepted", "Preparing", "Completed", "Cancelled"]
              .map((status) => `
                <option value="${status}" ${
                  order.status === status ? "selected" : ""
                }>
                  ${status}
                </option>
              `).join("")}
          </select>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="5">এখনো কোনো Order নেই।</td></tr>';
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
   14. CONTACT FORM
========================================= */

function setupContactForm() {
  $("contactForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const form = event.currentTarget;

    // এখানে কোনো Email পাঠানো হচ্ছে না।
    // Email integration পরে Backend দিয়ে যুক্ত করতে হবে।

    notify("ধন্যবাদ! Contact Form পূরণ হয়েছে।");
    form.reset();
  });
}

/* =========================================
   15. GLOBAL BUTTON SUPPORT
========================================= */

// HTML-এ inline onclick থাকলেও ব্যবহার করা যাবে।
window.openAdminLogin = openAdminLogin;
window.closeAdminLogin = closeAdminLogin;
window.openCart = openCart;
window.closeCart = closeCart;
window.logoutAdmin = logoutAdmin;
window.loadWebsite = loadWebsite;
window.renderFoods = renderFoods;
