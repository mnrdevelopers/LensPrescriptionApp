// products.js - Products and Cart Management

let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Load products from Firestore
async function loadProducts() {
    try {
        const snapshot = await db.collection('products')
            .where('active', '==', true)
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
        console.error('Error loading products:', error);
        showStatusMessage('Error loading products', 'error');
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
                     class="card-img-top" alt="${product.name}" style="height: 200px; object-fit: cover;">
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
            product.description.toLowerCase().includes(searchTerm)
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
    document.getElementById('productModalImage').src = product.imageUrl || 'https://via.placeholder.com/400x300?text=No+Image';
    
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
                    <img src="${item.imageUrl || 'https://via.placeholder.com/50x50?text=No+Image'}" 
                         class="rounded me-3" width="50" height="50" style="object-fit: cover;">
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

// Checkout with Razorpay
async function checkout() {
    if (cart.length === 0) return;
    
    const user = auth.currentUser;
    if (!user) {
        showStatusMessage('Please login to checkout', 'error');
        return;
    }
    
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    try {
        // Create order in Firestore
        const orderData = {
            userId: user.uid,
            userEmail: user.email,
            items: cart,
            totalAmount: totalAmount,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const orderRef = await db.collection('orders').add(orderData);
        
        // Razorpay options
        const options = {
            key: 'YOUR_RAZORPAY_KEY_ID', // Replace with your Razorpay key
            amount: totalAmount * 100, // Amount in paise
            currency: 'INR',
            name: 'Lens Prescription',
            description: 'Eyewear Products Order',
            order_id: null, // We'll create order first if needed
            handler: async function(response) {
                // Payment successful
                await orderRef.update({
                    status: 'paid',
                    paymentId: response.razorpay_payment_id,
                    orderId: response.razorpay_order_id,
                    paymentSignature: response.razorpay_signature,
                    paidAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Update product stock
                for (const item of cart) {
                    const productRef = db.collection('products').doc(item.id);
                    const productDoc = await productRef.get();
                    if (productDoc.exists) {
                        const currentStock = productDoc.data().stock;
                        await productRef.update({
                            stock: currentStock - item.quantity
                        });
                    }
                }
                
                // Clear cart
                cart = [];
                updateCart();
                
                showStatusMessage('Payment successful! Order confirmed.', 'success');
                
                // Close cart offcanvas
                const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('cartOffcanvas'));
                offcanvas.hide();
            },
            prefill: {
                name: user.displayName || '',
                email: user.email,
                contact: '' // You can store user phone in profile
            },
            theme: {
                color: '#007bff'
            }
        };
        
        const rzp = new Razorpay(options);
        rzp.open();
        
    } catch (error) {
        console.error('Checkout error:', error);
        showStatusMessage('Checkout failed. Please try again.', 'error');
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

// Initialize cart on page load
document.addEventListener('DOMContentLoaded', function() {
    updateCart();
});

// Make functions available globally
window.filterProducts = filterProducts;
window.viewProduct = viewProduct;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.checkout = checkout;
