// products.js - Products and Cart Management with Neon Database and Mock Fallback

let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let razorpayKey = null;

// --- MOCK PRODUCT DATA (FALLBACK) ---
const MOCK_PRODUCTS = [
    {
        id: 'mock1',
        name: 'Anti-Glare Premium Lenses',
        description: 'High-index lenses with advanced anti-glare coating.',
        category: 'lenses',
        price: 3500.00,
        stock: 50,
        imageUrl: 'https://placehold.co/300x200/28a745/ffffff?text=Premium+Lens',
    },
    {
        id: 'mock2',
        name: 'Titanium Half-Rim Frame',
        description: 'Lightweight and durable titanium frame, stylish half-rim design.',
        category: 'frames',
        price: 4999.00,
        stock: 12,
        imageUrl: 'https://placehold.co/300x200/007bff/ffffff?text=Titanium+Frame',
    },
    {
        id: 'mock3',
        name: 'UV Protection Sunglasses',
        description: 'Polarized lenses offering 100% UV protection, modern style.',
        category: 'sunglasses',
        price: 2500.00,
        stock: 30,
        imageUrl: 'https://placehold.co/300x200/ffc107/333333?text=Sunglasses',
    },
    {
        id: 'mock4',
        name: 'Lens Cleaning Kit',
        description: 'Complete kit including micro-fiber cloth and cleaning spray.',
        category: 'accessories',
        price: 250.00,
        stock: 100,
        imageUrl: 'https://placehold.co/300x200/6c757d/ffffff?text=Cleaning+Kit',
    },
];

// Initialize Razorpay
async function initializeRazorpay() {
    try {
        // Attempt to fetch key from Netlify function
        const response = await fetch('/.netlify/functions/get-razorpay-key');
        
        if (!response.ok) {
            console.warn('Netlify function for Razorpay key failed (404/500). Payment features will be disabled.');
            // Do NOT throw an error here, just skip setting the key
            showStatusMessage('Payment system temporarily unavailable', 'warning');
            return;
        }
        
        const data = await response.json();
        razorpayKey = data.keyId;
        
        console.log('Razorpay initialized successfully');
    } catch (error) {
        console.warn('Error fetching Razorpay key:', error);
        showStatusMessage('Payment system temporarily unavailable', 'warning');
    }
}

// Load products from Neon database or use mock data
async function loadProducts() {
    try {
        // 1. Try to fetch real products from Netlify function
        const response = await fetch('/.netlify/functions/get-products');
        
        if (!response.ok) {
            console.error('Failed to fetch products from Netlify function (404/500). Falling back to mock data.', await response.text());
            throw new Error('Netlify function failure'); 
        }
        
        products = await response.json();
        
        // 2. Load images for products if data fetch succeeded
        // NOTE: The original `loadProductImages` relies on another Netlify function that might also fail (404).
        // Since we cannot fix the backend structure, we simplify image loading.
        // We assume the successful `get-products` response includes `imageUrl` or use a fallback if not.
        products.forEach(product => {
             if (!product.imageUrl) {
                 product.imageUrl = `https://placehold.co/300x200/000000/ffffff?text=${encodeURIComponent(product.name)}`;
             }
        });

    } catch (error) {
        // 3. Fallback to mock data on failure (e.g., 404 on Netlify function)
        console.log('Using MOCK data for products display.');
        products = MOCK_PRODUCTS;
        showStatusMessage('Using mock product data. Backend services unreachable.', 'warning');
    }
    
    // 4. Display the loaded (or mock) products
    displayProducts(products);
}

// REMOVED: loadProductImages function is removed as it relies on a failing Netlify function (`get-product-image`) 
// and the main `loadProducts` function is updated to use mock data with placeholder image URLs.

// Display products in grid
function displayProducts(productsToShow) {
    const grid = document.getElementById('productsGrid');
    
    if (!grid) return; // Safety check
    
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
                <!-- Use the imageUrl directly from the mock data or successful API response -->
                <img src="${product.imageUrl}" 
                     class="card-img-top" alt="${product.name}" 
                     style="height: 200px; object-fit: cover;"
                     onerror="this.src='https://placehold.co/300x200?text=No+Image'">
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
                                ${product.stock <= 0 ? 'disabled' : ''}>
                            <i class="fas fa-eye"></i> View Details
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Filter products
function filterProducts() {
    const searchTerm = document.getElementById('productSearch')?.value.toLowerCase();
    const category = document.getElementById('categoryFilter')?.value;
    
    let filteredProducts = products;
    
    if (searchTerm) {
        filteredProducts = filteredProducts.filter(product => 
            product.name.toLowerCase().includes(searchTerm) ||
            (product.description && product.description.toLowerCase().includes(searchTerm))
        );
    }
    
    if (category && category !== 'all') {
        filteredProducts = filteredProducts.filter(product => product.category === category);
    }
    
    displayProducts(filteredProducts);
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
    document.getElementById('productModalImage').src = product.imageUrl;
    document.getElementById('productModalImage').onerror = function() {
        this.src = 'https://placehold.co/400x300?text=No+Image';
    };
    
    // Set max quantity based on stock
    const quantityInput = document.getElementById('quantity');
    if (quantityInput) {
        quantityInput.value = 1;
        quantityInput.max = product.stock;
    }

    // Store current product ID in modal for cart operations
    document.getElementById('productModal').dataset.productId = productId;
    
    const modal = new bootstrap.Modal(document.getElementById('productModal'));
    modal.show();
}

// Add to cart
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
        existingItem.quantity += quantity;
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
    if (modal) modal.hide();
}

// Update cart display
function updateCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    if (!cartItems || !cartTotal || !checkoutBtn) return;

    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="text-muted text-center">Your cart is empty</p>';
        cartTotal.textContent = '0.00';
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
                    <img src="${item.imageUrl}" 
                         class="rounded me-3" width="50" height="50" style="object-fit: cover;"
                         onerror="this.src='https://placehold.co/50x50?text=No+Image'">
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
    // Disable checkout if Razorpay key is missing (meaning the function failed)
    checkoutBtn.disabled = !razorpayKey; 
    checkoutBtn.textContent = razorpayKey ? 'Checkout' : 'Checkout Unavailable';
}

// Remove from cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
    showStatusMessage('Product removed from cart', 'success');
}

// Create Razorpay order (server-side)
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
            console.error('API Error creating Razorpay order:', await response.text());
            throw new Error('Failed to create Razorpay order');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        throw error;
    }
}

// Checkout with Razorpay
async function checkout() {
    if (cart.length === 0) return;
    
    const user = auth.currentUser;
    if (!user) {
        showStatusMessage('Please login to checkout', 'error');
        return;
    }
    
    // Check if Razorpay key is present
    if (!razorpayKey) {
        showStatusMessage('Payment system unavailable. Please try again later.', 'error');
        return;
    }
    
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    try {
        // Create order in Firestore first (or you can use Neon for orders too)
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
                name: user.displayName || 'Customer',
                email: user.email,
                contact: '' 
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
        showStatusMessage('Checkout failed. Please try again. (Check Netlify functions deployment status)', 'error');
    }
}

// Verify payment after success
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
            console.error('API Error verifying payment:', await verifyResponse.text());
            throw new Error('Payment verification failed');
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

            // Update product stock in Neon (requires running netlify function)
            const updatePromises = cart.map(item => updateProductStock(item.id, item.quantity).catch(err => {
                console.error(`Failed to update stock for product ${item.id}:`, err);
                showStatusMessage(`Warning: Failed to update stock for some products.`, 'warning');
            }));
            await Promise.all(updatePromises);

            // Clear cart
            cart = [];
            updateCart();
            
            showStatusMessage('Payment successful! Order confirmed.', 'success');
            
            // Close cart offcanvas
            const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('cartOffcanvas'));
            if (offcanvas) offcanvas.hide();
        } else {
            throw new Error('Payment verification failed');
        }
        
    } catch (error) {
        console.error('Payment verification error:', error);
        showStatusMessage('Payment verification failed. Please contact support.', 'error');
    }
}

// Update product stock in Neon
async function updateProductStock(productId, quantity) {
    // NOTE: This assumes `update-product` is correctly deployed and working.
    // If this fails, it indicates a secondary Netlify function deployment issue.
    
    // For mock data, we skip this to prevent errors, but for real products, we proceed.
    if (productId.startsWith('mock')) {
        console.log(`Skipping stock update for mock product ID: ${productId}`);
        return;
    }

    try {
        // Need to fetch current stock before updating (since we don't have transaction support here)
        const currentStock = await getCurrentStock(productId);
        const newStock = currentStock - quantity;

        const response = await fetch(`/.netlify/functions/update-product`, { // Changed path to hit root function
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: productId, // Assuming update-product can take the ID in body/query or path
                stock: newStock
            })
        });

        if (!response.ok) {
            console.error('Stock update API response error:', await response.text());
            throw new Error('Failed to update product stock');
        }
    } catch (error) {
        console.error('Error updating product stock:', error);
        throw error;
    }
}

// Get current stock from Neon
async function getCurrentStock(productId) {
    // NOTE: This relies on the successful `get-products` function
    try {
        // Find product in the currently loaded `products` array instead of re-fetching all
        const product = products.find(p => p.id === productId);
        return product ? product.stock : 0;
    } catch (error) {
        console.error('Error getting current stock from internal list:', error);
        return 0;
    }
}

// Show status message
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
    // Initialize Razorpay early (it will attempt to fetch key, but won't block execution)
    initializeRazorpay();
    
    // Update cart UI based on local storage
    updateCart();
});

// Make functions available globally
window.loadProducts = loadProducts; // Must be called from products.html
window.filterProducts = filterProducts;
window.viewProduct = viewProduct;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.checkout = checkout;
