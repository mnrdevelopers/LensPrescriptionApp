// products.js - Products and Cart Management with Firebase Firestore

// NOTE: Products data is now fetched directly from Firebase Firestore.
// The Netlify product functions relying on Neon DB have been removed.

let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let razorpayKey = null;

// Initialize Razorpay
async function initializeRazorpay() {
    try {
        // Use the existing Netlify function to fetch the public key (if needed for Razorpay init)
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

// Load products from Firebase Firestore (REPLACING NETLIFY FUNCTION)
async function loadProducts() {
    // Check for user/db presence
    if (typeof db === 'undefined') {
        setTimeout(loadProducts, 100); // Retry if Firebase not yet initialized
        return;
    }
    
    try {
        // Fetch only active products (stock > 0 and active: true)
        const snapshot = await db.collection('products')
            .where('active', '==', true)
            .where('stock', '>', 0)
            .orderBy('stock', 'desc') // Show in-stock items first
            .orderBy('name', 'asc')
            .get();
        
        products = [];
        snapshot.forEach(doc => {
            products.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // No need for loadProductImages, as the imageUrl is stored in the document.
        
        displayProducts(products);
    } catch (error) {
        console.error('Error loading products from Firestore:', error);
        showStatusMessage(`Error loading products: ${error.message}`, 'error');
        
        // Display fallback products or empty state
        displayProducts([]);
    }
}

// Display products in grid (No change needed here)
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
                        <button class="btn btn-primary w-100 mt-2" 
                                onclick="viewProduct('${product.id}')"
                                ${product.stock === 0 ? 'disabled' : ''}>
                            <i class="fas fa-eye"></i> View Details
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Filter products (No change needed here)
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

// View product details (No change needed here)
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
    
    // Set max quantity in the modal
    const quantityInput = document.getElementById('quantity');
    quantityInput.value = 1;
    quantityInput.setAttribute('max', product.stock);

    // Store current product ID in modal for cart operations
    document.getElementById('productModal').dataset.productId = productId;
    
    const modal = new bootstrap.Modal(document.getElementById('productModal'));
    modal.show();
}

// Add to cart (No change needed here)
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
        // Prevent adding more than stock
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
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
    modal.hide();
}

// Update cart display (No change needed here)
function updateCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    
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
            <div class="cart-item mb-3 p-2 border rounded">
                <div class="d-flex align-items-center">
                    <img src="${item.imageUrl || 'https://via.placeholder.com/50x50?text=No+Image'}" 
                         class="rounded me-3" width="50" height="50" style="object-fit: cover;"
                         onerror="this.src='https://via.placeholder.com/50x50?text=No+Image'">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${item.name}</h6>
                        <p class="mb-1">₹${item.price.toFixed(2)} x ${item.quantity}</p>
                        <small class="text-muted">Total: ₹${itemTotal.toFixed(2)}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeFromCart('${item.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    cartTotal.textContent = total.toFixed(2);
    checkoutBtn.disabled = false;
}

// Remove from cart (No change needed here)
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
    showStatusMessage('Product removed from cart', 'success');
}

// Create Razorpay order (server-side - Netlify function retained)
async function createRazorpayOrder(amount, orderId) {
    try {
        const response = await fetch('/.netlify/functions/create-razorpay-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: amount * 100, // Convert to paise
                currency: 'INR',
                receipt: orderId
            })
        });

        if (!response.ok) {
            // Attempt to get error details from the response body
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

// Checkout with Razorpay (Mostly retained, order creation updated)
async function checkout() {
    if (cart.length === 0) return;
    
    const user = auth.currentUser;
    if (!user) {
        showStatusMessage('Please login to checkout', 'error');
        return;
    }
    
    // Ensure Razorpay is initialized
    if (!razorpayKey) {
        await initializeRazorpay();
        if (!razorpayKey) {
            showStatusMessage('Payment system unavailable. Please try again.', 'error');
            return;
        }
    }
    
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    try {
        // Create order in Firestore first
        const orderData = {
            userId: user.uid,
            userEmail: user.email,
            items: cart,
            totalAmount: totalAmount,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const orderRef = await db.collection('orders').add(orderData);
        
        // Create Razorpay order
        const razorpayOrder = await createRazorpayOrder(totalAmount, orderRef.id);
        
        // Razorpay options
        const options = {
            key: razorpayKey,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            name: 'Lens Prescription',
            description: 'Eyewear Products Order',
            order_id: razorpayOrder.id,
            handler: async function(response) {
                // Payment successful - verify payment
                await verifyPayment(response, orderRef.id, totalAmount);
            },
            prefill: {
                name: user.displayName || '',
                email: user.email,
                contact: '' // You can store user phone in profile
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

// Verify payment after success (Netlify function retained)
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
            // Payment verified successfully
            await db.collection('orders').doc(orderId).update({
                status: 'paid',
                paymentId: paymentResponse.razorpay_payment_id,
                orderId: paymentResponse.razorpay_order_id,
                paymentSignature: paymentResponse.razorpay_signature,
                paidAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update product stock in Firestore (REPLACING NETLIFY FUNCTION)
            const stockUpdates = cart.map(item => updateProductStock(item.id, item.quantity));
            await Promise.all(stockUpdates);

            // Clear cart
            cart = [];
            updateCart();
            
            showStatusMessage('Payment successful! Order confirmed and stock updated.', 'success');
            
            // Close cart offcanvas
            const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('cartOffcanvas'));
            offcanvas.hide();

            // Reload products to reflect new stock
            loadProducts(); 
        } else {
            throw new Error('Payment verification failed: Invalid signature.');
        }
        
    } catch (error) {
        console.error('Payment verification error:', error);
        showStatusMessage('Payment verification failed. Please contact support. Details: ' + error.message, 'error');
    }
}

// Update product stock in Firestore (REPLACING NETLIFY FUNCTION)
async function updateProductStock(productId, quantity) {
    const productRef = db.collection('products').doc(productId);
    
    try {
        // Use a transaction to safely update stock
        await db.runTransaction(async (t) => {
            const doc = await t.get(productRef);
            if (!doc.exists) {
                throw new Error("Product does not exist!");
            }

            const currentStock = doc.data().stock || 0;
            const newStock = currentStock - quantity;

            if (newStock < 0) {
                // This should be caught earlier, but as a fail-safe
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
        throw error; // Re-throw to fail the overall checkout promise if stock update fails
    }
}

// Get current stock from Firebase Firestore (REPLACING NETLIFY FUNCTION - Note: no longer strictly needed due to transaction logic)
async function getCurrentStock(productId) {
    try {
        const doc = await db.collection('products').doc(productId).get();
        return doc.exists ? doc.data().stock || 0 : 0;
    } catch (error) {
        console.error('Error getting current stock from Firestore:', error);
        return 0;
    }
}


// Show status message, getStatusIcon, getStatusColor (Retained - no change needed)
function showStatusMessage(message, type = 'info') {
    // Remove existing messages
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
window.loadProducts = loadProducts; // Export loadProducts for manual calls
