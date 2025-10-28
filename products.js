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
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    cartTotal.textContent = total.toFixed(2);
    checkoutBtn.disabled = false;
}

// Update quantity
function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;
    
    const newQuantity = item.quantity + change;
    
    if (newQuantity < 1) {
        removeFromCart(productId);
        return;
    }
    
    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.stock) {
        showStatusMessage(`Only ${product.stock} items available in stock`, 'error');
        return;
    }
    
    item.quantity = newQuantity;
    updateCart();
}

// Remove from cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
    showStatusMessage('Product removed from cart', 'success');
}

// Buy Now function
async function buyNow(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const user = auth.currentUser;
    if (!user) {
        showStatusMessage('Please login to purchase', 'error');
        return;
    }
    
    const tempCart = [{
        id: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        quantity: 1
    }];
    
    const totalAmount = product.price;
    
    try {
        const orderData = {
            userId: user.uid,
            userEmail: user.email,
            items: tempCart,
            totalAmount: totalAmount,
            status: 'pending',
            type: 'direct_purchase',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const orderRef = await db.collection('orders').add(orderData);
        
        const razorpayOrder = await createRazorpayOrder(totalAmount, orderRef.id);
        
        const options = {
            key: razorpayKey,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            name: 'Lens Prescription',
            description: 'Direct Purchase - ' + product.name,
            order_id: razorpayOrder.id,
            handler: async function(response) {
                await verifyDirectPayment(response, orderRef.id, totalAmount, productId);
            },
            prefill: {
                name: user.displayName || '',
                email: user.email,
            },
            theme: {
                color: '#007bff'
            },
            modal: {
                ondismiss: function() {
                    showStatusMessage('Purchase cancelled', 'warning');
                }
            }
        };
        
        const rzp = new Razorpay(options);
        rzp.open();
        
    } catch (error) {
        console.error('Buy Now error:', error);
        showStatusMessage('Purchase failed. Please try again.', 'error');
    }
}

// Create Razorpay order
async function createRazorpayOrder(amount, orderId) {
    try {
        const response = await fetch('/.netlify/functions/create-razorpay-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: amount * 100,
                currency: 'INR',
                receipt: orderId
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Failed to create Razorpay order. HTTP Status: ${response.status}.`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage += ` Details: ${errorJson.details || errorJson.error}`;
            } catch {
                errorMessage += ` Response: ${errorText.substring(0, 100)}...`;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        throw error;
    }
}

// Verify direct payment
async function verifyDirectPayment(paymentResponse, orderId, totalAmount, productId) {
    try {
        const verifyResponse = await fetch('/.netlify/functions/verify-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature
            })
        });

        if (!verifyResponse.ok) {
            throw new Error('Payment verification failed');
        }

        const verification = await verifyResponse.json();

        if (verification.valid) {
            await db.collection('orders').doc(orderId).update({
                status: 'paid',
                paymentId: paymentResponse.razorpay_payment_id,
                orderId: paymentResponse.razorpay_order_id,
                paymentSignature: paymentResponse.razorpay_signature,
                paidAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await updateProductStock(productId, 1);

            showStatusMessage('Purchase successful! Order confirmed.', 'success');
            loadProducts();
        } else {
            throw new Error('Payment verification failed');
        }
        
    } catch (error) {
        console.error('Direct payment verification error:', error);
        showStatusMessage('Payment verification failed. Please contact support.', 'error');
    }
}

// Checkout function
async function checkout() {
    if (cart.length === 0) return;
    
    const user = auth.currentUser;
    if (!user) {
        showStatusMessage('Please login to checkout', 'error');
        return;
    }
    
    if (!razorpayKey) {
        await initializeRazorpay();
        if (!razorpayKey) {
            showStatusMessage('Payment system unavailable. Please try again.', 'error');
            return;
        }
    }
    
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    try {
        const orderData = {
            userId: user.uid,
            userEmail: user.email,
            items: cart,
            totalAmount: totalAmount,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const orderRef = await db.collection('orders').add(orderData);
        
        const razorpayOrder = await createRazorpayOrder(totalAmount, orderRef.id);
        
        const options = {
            key: razorpayKey,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            name: 'Lens Prescription',
            description: 'Eyewear Products Order',
            order_id: razorpayOrder.id,
            handler: async function(response) {
                await verifyPayment(response, orderRef.id, totalAmount);
            },
            prefill: {
                name: user.displayName || '',
                email: user.email,
            },
            theme: {
                color: '#007bff'
            },
            modal: {
                ondismiss: function() {
                    showStatusMessage('Payment cancelled', 'warning');
                }
            }
        };
        
        const rzp = new Razorpay(options);
        rzp.open();
        
    } catch (error) {
        console.error('Checkout error:', error);
        showStatusMessage('Checkout failed. Please try again. Details: ' + error.message, 'error');
    }
}

// Verify payment
async function verifyPayment(paymentResponse, orderId, totalAmount) {
    try {
        const verifyResponse = await fetch('/.netlify/functions/verify-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature
            })
        });

        if (!verifyResponse.ok) {
            throw new Error('Payment verification failed on server side');
        }

        const verification = await verifyResponse.json();

        if (verification.valid) {
            await db.collection('orders').doc(orderId).update({
                status: 'paid',
                paymentId: paymentResponse.razorpay_payment_id,
                orderId: paymentResponse.razorpay_order_id,
                paymentSignature: paymentResponse.razorpay_signature,
                paidAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            const stockUpdates = cart.map(item => updateProductStock(item.id, item.quantity));
            await Promise.all(stockUpdates);

            cart = [];
            updateCart();
            
            showStatusMessage('Payment successful! Order confirmed and stock updated.', 'success');
            
            const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('cartOffcanvas'));
            offcanvas.hide();

            loadProducts();
        } else {
            throw new Error('Payment verification failed: Invalid signature.');
        }
        
    } catch (error) {
        console.error('Payment verification error:', error);
        showStatusMessage('Payment verification failed. Please contact support. Details: ' + error.message, 'error');
    }
}

// Update product stock
async function updateProductStock(productId, quantity) {
    const productRef = db.collection('products').doc(productId);
    
    try {
        await db.runTransaction(async (t) => {
            const doc = await t.get(productRef);
            if (!doc.exists) {
                throw new Error("Product does not exist!");
            }

            const currentStock = doc.data().stock || 0;
            const newStock = currentStock - quantity;

            if (newStock < 0) {
                throw new Error(`Insufficient stock for product ${productId}. Available: ${currentStock}`);
            }

            t.update(productRef, { 
                stock: newStock,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

    } catch (error) {
        console.error(`Transaction failed for product ${productId}:`, error);
        showStatusMessage(`Failed to update stock for product: ${productId}`, 'error');
        throw error;
    }
}

// Show status message
function showStatusMessage(message, type = 'info') {
    const existingMessages = document.querySelectorAll('.status-message');
    existingMessages.forEach(msg => msg.remove());
    
    const statusMessage = document.createElement('div');
    statusMessage.className = `status-message alert status-${type}`;
    statusMessage.innerHTML = `
        <i class="fas fa-${getStatusIcon(type)}"></i>
        ${message}
    `;
    statusMessage.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 10000;
        min-width: 250px;
        padding: 12px 16px;
        border-radius: 8px;
        background: ${getStatusColor(type)};
        color: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
    `;
    
    document.body.appendChild(statusMessage);
    
    setTimeout(() => {
        if (statusMessage.parentNode) {
            statusMessage.remove();
        }
    }, 4000);
}

function getStatusIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function getStatusColor(type) {
    const colors = {
        'success': '#28a745',
        'error': '#dc3545',
        'warning': '#ffc107',
        'info': '#17a2b8'
    };
    return colors[type] || '#17a2b8';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeRazorpay();
    updateCart();
});

// Make functions available globally
window.filterProducts = filterProducts;
window.viewProduct = viewProduct;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.checkout = checkout;
window.loadProducts = loadProducts;
window.buyNow = buyNow;
window.updateQuantity = updateQuantity;
window.addToCartDirect = addToCartDirect;
window.quickView = quickView;
