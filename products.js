// products.js - Products and Cart Management with Firebase Firestore

let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let razorpayKey = null;

// Initialize Razorpay
async function initializeRazorpay() {
    try {
        const response = await fetch('/.netlify/functions/get-razorpay-key');
        
        if (!response.ok) {
            throw new Error('Failed to fetch Razorpay key');
        }
        
        const data = await response.json();
        razorpayKey = data.keyId;
        
        console.log('Razorpay initialized successfully');
    } catch (error) {
        console.error('Error initializing Razorpay:', error);
        showStatusMessage('Payment system temporarily unavailable', 'error');
    }
}

// Load products from Firebase Firestore
async function loadProducts() {
    if (typeof db === 'undefined') {
        setTimeout(loadProducts, 100);
        return;
    }
    
    try {
        const snapshot = await db.collection('products')
            .where('active', '==', true)
            .where('stock', '>', 0)
            .orderBy('stock', 'desc')
            .orderBy('name', 'asc')
            .get();
        
        products = [];
        snapshot.forEach(doc => {
            products.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        displayProducts(products);
    } catch (error) {
        console.error('Error loading products from Firestore:', error);
        showStatusMessage(`Error loading products: ${error.message}`, 'error');
        displayProducts([]);
    }
}

// Display products in grid
function displayProducts(productsToShow) {
    const grid = document.getElementById('productsGrid');
    
    if (productsToShow.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center">
                <p class="text-muted">No products found</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = productsToShow.map(product => `
        <div class="col-lg-4 col-md-6 mb-4">
            <div class="card product-card h-100">
                <img src="${product.imageUrl || 'https://via.placeholder.com/300x200?text=No+Image'}" 
                     class="card-img-top" alt="${product.name}" 
                     style="height: 200px; object-fit: cover;"
                     onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">${product.name}</h5>
                    <p class="card-text text-muted">${product.category}</p>
                    <p class="card-text flex-grow-1">${product.description || 'No description available.'}</p>
                    <div class="mt-auto">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="text-primary mb-0">₹${product.price.toFixed(2)}</h5>
                            <span class="badge ${product.stock > 0 ? 'bg-success' : 'bg-danger'}">
                                ${product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                            </span>
                        </div>
                        <div class="d-grid gap-2 mt-2">
                            <button class="btn btn-outline-primary" 
                                    onclick="quickView('${product.id}')"
                                    ${product.stock === 0 ? 'disabled' : ''}>
                                <i class="fas fa-eye"></i> Quick View
                            </button>
                            <button class="btn btn-success" 
                                    onclick="buyNow('${product.id}')"
                                    ${product.stock === 0 ? 'disabled' : ''}>
                                <i class="fas fa-bolt"></i> Buy Now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Filter products
function filterProducts() {
    const searchTerm = document.getElementById('productSearch').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    
    let filteredProducts = products;
    
    if (searchTerm) {
        filteredProducts = filteredProducts.filter(product => 
            product.name.toLowerCase().includes(searchTerm) ||
            (product.description && product.description.toLowerCase().includes(searchTerm))
        );
    }
    
    if (category !== 'all') {
        filteredProducts = filteredProducts.filter(product => product.category === category);
    }
    
    displayProducts(filteredProducts);
}

// Quick View function
function quickView(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    document.getElementById('quickViewImage').src = product.imageUrl || 'https://via.placeholder.com/400x300?text=No+Image';
    document.getElementById('quickViewName').textContent = product.name;
    document.getElementById('quickViewPrice').textContent = product.price.toFixed(2);
    document.getElementById('quickViewDescription').textContent = product.description || 'No description available.';
    document.getElementById('quickViewStock').textContent = product.stock;
    document.getElementById('quickViewCategory').textContent = product.category;
    
    document.getElementById('quickViewAddToCart').onclick = () => {
        addToCartDirect(productId, 1);
        bootstrap.Modal.getInstance(document.getElementById('quickViewModal')).hide();
    };
    
    document.getElementById('quickViewBuyNow').onclick = () => {
        bootstrap.Modal.getInstance(document.getElementById('quickViewModal')).hide();
        buyNow(productId);
    };
    
    new bootstrap.Modal(document.getElementById('quickViewModal')).show();
}

// Add to cart directly
function addToCartDirect(productId, quantity = 1) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    if (quantity > product.stock) {
        showStatusMessage('Not enough stock available', 'error');
        return;
    }
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > product.stock) {
            showStatusMessage(`Cannot add more. Only ${product.stock} available.`, 'error');
            return;
        }
        existingItem.quantity = newQuantity;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            imageUrl: product.imageUrl,
            quantity: quantity
        });
    }
    
    updateCart();
    showStatusMessage('Product added to cart', 'success');
}

// View product details
function viewProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    document.getElementById('productModalTitle').textContent = product.name;
    document.getElementById('productModalName').textContent = product.name;
    document.getElementById('productModalCategory').textContent = product.category;
    document.getElementById('productModalDescription').textContent = product.description || 'No description available.';
    document.getElementById('productModalPrice').textContent = product.price.toFixed(2);
    document.getElementById('productModalStock').textContent = product.stock > 0 ? `${product.stock} in stock` : 'Out of stock';
    document.getElementById('productModalImage').src = product.imageUrl || 'https://via.placeholder.com/400x300?text=No+Image';
    document.getElementById('productModalImage').onerror = function() {
        this.src = 'https://via.placeholder.com/400x300?text=No+Image';
    };
    
    const quantityInput = document.getElementById('quantity');
    quantityInput.value = 1;
    quantityInput.setAttribute('max', product.stock);

    document.getElementById('productModal').dataset.productId = productId;
    
    const modal = new bootstrap.Modal(document.getElementById('productModal'));
    modal.show();
}

// Add to cart from modal
function addToCart() {
    const productId = document.getElementById('productModal').dataset.productId;
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const product = products.find(p => p.id === productId);
    
    if (!product) return;
    
    if (quantity > product.stock) {
        showStatusMessage('Not enough stock available', 'error');
        return;
    }
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > product.stock) {
            showStatusMessage(`Cannot add more. Only ${product.stock} available.`, 'error');
            return;
        }
        existingItem.quantity = newQuantity;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            imageUrl: product.imageUrl,
            quantity: quantity
        });
    }
    
    updateCart();
    showStatusMessage('Product added to cart', 'success');
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
    modal.hide();
}

// Update cart display
function updateCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartDisplay();
    updateCartBadge();
}

// Update cart badge
function updateCartBadge() {
    const cartBadge = document.getElementById('cartBadge');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartBadge.textContent = totalItems;
    
    if (totalItems === 0) {
        cartBadge.style.display = 'none';
    } else {
        cartBadge.style.display = 'block';
    }
}

// Update cart display
function updateCartDisplay() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="text-muted text-center">Your cart is empty</p>';
        cartTotal.textContent = '0';
        checkoutBtn.disabled = true;
        return;
    }
    
    let total = 0;
    cartItems.innerHTML = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        return `
            <div class="cart-item mb-3 p-3 border rounded">
                <div class="d-flex align-items-center">
                    <img src="${item.imageUrl || 'https://via.placeholder.com/60x60?text=No+Image'}" 
                         class="rounded me-3" width="60" height="60" style="object-fit: cover;"
                         onerror="this.src='https://via.placeholder.com/60x60?text=No+Image'">
                    <div class="flex-grow-1">
                        <h6 class="mb-1 fw-bold">${item.name}</h6>
                        <div class="d-flex align-items-center mb-2">
                            <button class="btn btn-sm btn-outline-secondary" onclick="updateQuantity('${item.id}', -1)">-</button>
                            <span class="mx-3 fw-bold">${item.quantity}</span>
                            <button class="btn btn-sm btn-outline-secondary" onclick="updateQuantity('${item.id}', 1)">+</button>
                        </div>
                        <small class="text-muted">₹${item.price.toFixed(2)} each</small>
                    </div>
                    <div class="text-end">
                        <div class="fw-bold mb-2">₹${itemTotal.toFixed(2)}</div>
                        <button class="btn btn-sm btn-outline-danger" onclick="removeFromCart('${item.id}')">
                            <i class="fas
