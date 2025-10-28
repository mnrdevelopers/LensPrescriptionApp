// inventory.js - Inventory Management for Admin

let inventory = [];

// Load inventory from Firestore
async function loadInventory() {
    try {
        const snapshot = await db.collection('products').get();
        
        inventory = [];
        snapshot.forEach(doc => {
            inventory.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        displayInventory();
    } catch (error) {
        console.error('Error loading inventory:', error);
        showStatusMessage('Error loading inventory', 'error');
    }
}

// Display inventory in table
function displayInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    
    if (inventory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted">No products in inventory</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = inventory.map(product => `
        <tr>
            <td>
                <img src="${product.imageUrl || 'https://via.placeholder.com/50x50?text=No+Image'}" 
                     width="50" height="50" style="object-fit: cover;" class="rounded">
            </td>
            <td>${product.name}</td>
            <td>
                <span class="badge bg-secondary">${product.category}</span>
            </td>
            <td>₹${product.price}</td>
            <td>
                <span class="badge ${product.stock > 10 ? 'bg-success' : product.stock > 0 ? 'bg-warning' : 'bg-danger'}">
                    ${product.stock}
                </span>
            </td>
            <td>
                <span class="badge ${product.active ? 'bg-success' : 'bg-secondary'}">
                    ${product.active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editProduct('${product.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${product.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Add new product
async function addProduct() {
    const form = document.getElementById('addProductForm');
    const formData = new FormData();
    
    const productData = {
        name: document.getElementById('productName').value,
        category: document.getElementById('productCategory').value,
        price: parseFloat(document.getElementById('productPrice').value),
        stock: parseInt(document.getElementById('productStock').value),
        description: document.getElementById('productDescription').value,
        active: document.getElementById('productStatus').checked,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const imageFile = document.getElementById('productImage').files[0];
    
    if (!productData.name || !productData.category || !productData.price || !productData.stock) {
        showStatusMessage('Please fill all required fields', 'error');
        return;
    }
    
    try {
        let imageUrl = '';
        
        // Upload image if provided
        if (imageFile) {
            const storageRef = firebase.storage().ref();
            const imageRef = storageRef.child(`products/${Date.now()}_${imageFile.name}`);
            const snapshot = await imageRef.put(imageFile);
            imageUrl = await snapshot.ref.getDownloadURL();
            productData.imageUrl = imageUrl;
        }
        
        // Add product to Firestore
        await db.collection('products').add(productData);
        
        showStatusMessage('Product added successfully', 'success');
        
        // Reset form and close modal
        form.reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById('addProductModal'));
        modal.hide();
        
        // Reload inventory
        loadInventory();
        
    } catch (error) {
        console.error('Error adding product:', error);
        showStatusMessage('Error adding product', 'error');
    }
}

// Edit product
async function editProduct(productId) {
    const product = inventory.find(p => p.id === productId);
    if (!product) return;
    
    document.getElementById('editProductId').value = product.id;
    document.getElementById('editProductName').value = product.name;
    document.getElementById('editProductCategory').value = product.category;
    document.getElementById('editProductPrice').value = product.price;
    document.getElementById('editProductStock').value = product.stock;
    document.getElementById('editProductDescription').value = product.description || '';
    document.getElementById('editProductStatus').checked = product.active;
    document.getElementById('currentImageName').textContent = product.imageUrl ? 'Image uploaded' : 'No image';
    
    const modal = new bootstrap.Modal(document.getElementById('editProductModal'));
    modal.show();
}

// Update product
async function updateProduct() {
    const productId = document.getElementById('editProductId').value;
    const productData = {
        name: document.getElementById('editProductName').value,
        category: document.getElementById('editProductCategory').value,
        price: parseFloat(document.getElementById('editProductPrice').value),
        stock: parseInt(document.getElementById('editProductStock').value),
        description: document.getElementById('editProductDescription').value,
        active: document.getElementById('editProductStatus').checked,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const imageFile = document.getElementById('editProductImage').files[0];
    
    try {
        // Upload new image if provided
        if (imageFile) {
            const storageRef = firebase.storage().ref();
            const imageRef = storageRef.child(`products/${Date.now()}_${imageFile.name}`);
            const snapshot = await imageRef.put(imageFile);
            productData.imageUrl = await snapshot.ref.getDownloadURL();
        }
        
        // Update product in Firestore
        await db.collection('products').doc(productId).update(productData);
        
        showStatusMessage('Product updated successfully', 'success');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
        modal.hide();
        
        // Reload inventory
        loadInventory();
        
    } catch (error) {
        console.error('Error updating product:', error);
        showStatusMessage('Error updating product', 'error');
    }
}

// Delete product
async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }
    
    try {
        await db.collection('products').doc(productId).delete();
        showStatusMessage('Product deleted successfully', 'success');
        loadInventory();
    } catch (error) {
        console.error('Error deleting product:', error);
        showStatusMessage('Error deleting product', 'error');
    }
}

// Show status message (same as in products.js)
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

// Make functions available globally
window.addProduct = addProduct;
window.editProduct = editProduct;
window.updateProduct = updateProduct;
window.deleteProduct = deleteProduct;
