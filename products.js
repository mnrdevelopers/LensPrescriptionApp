// products.js - Products and Cart Management with Neon Database

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

// Load products from Neon database
async function loadProducts() {
    try {
        const response = await fetch('/.netlify/functions/get-products');
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        products = await response.json();
        
        // Load images for products
        await loadProductImages();
        
        displayProducts(products);
    } catch (error) {
        console.error('Error loading products:', error);
        showStatusMessage(`Error loading products: ${error.message}`, 'error');
        
        // Display fallback products or empty state
        displayProducts([]);
    }
}

// Load product images
async function loadProductImages() {
    for (let product of products) {
        if (product.imageName && !product.imageUrl) {
            try {
                const imageResponse = await fetch(`/.netlify/functions/get-product-image?id=${product.id}`);
                if (imageResponse.ok) {
                    const imageData = await imageResponse.json();
                    product.imageUrl = imageData.imageUrl;
                }
            } catch (error) {
                console.error(`Error loading image for product ${product.id}:`, error);
                product.imageUrl = 'https://via.placeholder.com/300x200?text=No+Image';
            }
        } else if (!product.imageUrl) {
            product.imageUrl = 'https://via.placeholder.com/300x200?text=No+Image';
        }
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
                <img src="${product.imageUrl}" 
                     class="card-img-top" alt="${product.name}" 
                     style="height: 200px; object-fit: cover;"
                     onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">${product.name}</h5>
                    <p class="card-text text-muted">${product.category}</p>
                    <p class="card-text flex-grow-1">${product.description || 'No description available.'}</p>
                    <div class="mt-auto">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="text-primary mb-0">₹${product.price}</h5>
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

// View product details
function viewProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    document.getElementById('productModalTitle').textContent = product.name;
    document.getElementById('productModalName').textContent = product.name;
    document.getElementById('productModalCategory').textContent = product.category;
    document.getElementById('productModalDescription').textContent = product.description || 'No description available.';
    document.getElementById('productModalPrice').textContent = product.price;
    document.getElementById('productModalStock').textContent = product.stock > 0 ? `${product.stock} in stock` : 'Out of stock';
    document.getElementById('productModalImage').src = product.imageUrl;
    document.getElementById('productModalImage').onerror = function() {
        this.src = 'https://via.placeholder.com/400x300?text=No+Image';
    };
    
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
    modal.hide();
}

// Update cart display
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
                    <img src="${item.imageUrl}" 
                         class="rounded me-3" width="50" height="50" style="object-fit: cover;"
                         onerror="this.src='https://via.placeholder.com/50x50?text=No+Image'">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${item.name}</h6>
                        <p class="mb-1">₹${item.price} x ${item.quantity}</p>
                        <small class="text-muted">Total: ₹${itemTotal}</small>
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
        showStatusMessage('Checkout failed. Please try again.', 'error');
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

            // Update product stock in Neon
            for (const item of cart) {
                await updateProductStock(item.id, item.quantity);
            }

            // Clear cart
            cart = [];
            updateCart();
            
            showStatusMessage('Payment successful! Order confirmed.', 'success');
            
            // Close cart offcanvas
            const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('cartOffcanvas'));
            offcanvas.hide();
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
    try {
        const response = await fetch(`/.netlify/functions/update-product/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                stock: await getCurrentStock(productId) - quantity
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update product stock');
        }
    } catch (error) {
        console.error('Error updating product stock:', error);
        throw error;
    }
}

// Get current stock from Neon
async function getCurrentStock(productId) {
    try {
        const response = await fetch('/.netlify/functions/get-products');
        if (!response.ok) throw new Error('Failed to fetch products');
        
        const products = await response.json();
        const product = products.find(p => p.id === productId);
        return product ? product.stock : 0;
    } catch (error) {
        console.error('Error getting current stock:', error);
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
    initializeRazorpay();
    updateCart();
});

// Make functions available globally
window.filterProducts = filterProducts;
window.viewProduct = viewProduct;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.checkout = checkout;
