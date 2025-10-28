// inventory.js - Inventory Management for Admin (Updated for Firebase-only operations)

// NOTE: This file assumes Firebase has been initialized and the db and auth objects are available globally.

let inventory = [];

// Load inventory from Firestore
async function loadInventory() {
    try {
        // Fetch all products for admin view, regardless of stock or active status
        const snapshot = await db.collection('products').orderBy('name', 'asc').get();
        
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
                     width="50" height="50" style="object-fit: cover;" class="rounded"
                     onerror="this.src='https://via.placeholder.com/50x50?text=No+Image'">
            </td>
            <td>${product.name}</td>
            <td>
                <span class="badge bg-secondary">${product.category}</span>
            </td>
            <td>₹${(product.price || 0).toFixed(2)}</td>
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
                <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteProduct('${product.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Add new product
async function addProduct() {
    const form = document.getElementById('addProductForm');
    
    // Validate stock and price are numbers
    const priceValue = parseFloat(document.getElementById('productPrice').value);
    const stockValue = parseInt(document.getElementById('productStock').value);

    const productData = {
        name: document.getElementById('productName').value.trim(),
        category: document.getElementById('productCategory').value.trim(),
        price: priceValue,
        stock: stockValue,
        description: document.getElementById('productDescription').value.trim(),
        active: document.getElementById('productStatus').checked,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const imageFile = document.getElementById('productImage').files[0];
    
    if (!productData.name || !productData.category || isNaN(productData.price) || productData.price <= 0 || isNaN(productData.stock) || productData.stock < 0) {
        showStatusMessage('Please fill all required fields correctly (Price > 0, Stock >= 0)', 'error');
        return;
    }
    
    const addButton = document.querySelector('#addProductModal .modal-footer .btn-primary');
    const originalText = addButton.textContent;
    addButton.textContent = 'Adding...';
    addButton.disabled = true;

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
        if (modal) modal.hide();
        
        // Reload inventory
        loadInventory();
        
    } catch (error) {
        console.error('Error adding product:', error);
        showStatusMessage('Error adding product: ' + error.message, 'error');
    } finally {
        addButton.textContent = originalText;
        addButton.disabled = false;
    }
}

// Edit product - Populates the modal
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

    // Validate stock and price are numbers
    const priceValue = parseFloat(document.getElementById('editProductPrice').value);
    const stockValue = parseInt(document.getElementById('editProductStock').value);
    
    const productData = {
        name: document.getElementById('editProductName').value.trim(),
        category: document.getElementById('editProductCategory').value.trim(),
        price: priceValue,
        stock: stockValue,
        description: document.getElementById('editProductDescription').value.trim(),
        active: document.getElementById('editProductStatus').checked,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const imageFile = document.getElementById('editProductImage').files[0];

    if (!productData.name || !productData.category || isNaN(productData.price) || productData.price <= 0 || isNaN(productData.stock) || productData.stock < 0) {
        showStatusMessage('Please fill all required fields correctly (Price > 0, Stock >= 0)', 'error');
        return;
    }
    
    const updateButton = document.querySelector('#editProductModal .modal-footer .btn-primary');
    const originalText = updateButton.textContent;
    updateButton.textContent = 'Updating...';
    updateButton.disabled = true;

    try {
        // Upload new image if provided
        if (imageFile) {
            const storageRef = firebase.storage().ref();
            // Delete old image if it exists and we have the URL (optional but good practice)
            // const oldProduct = inventory.find(p => p.id === productId);
            // if (oldProduct && oldProduct.imageUrl) {
            //     // Logic to delete old image from storage if necessary
            // }

            const imageRef = storageRef.child(`products/${Date.now()}_${imageFile.name}`);
            const snapshot = await imageRef.put(imageFile);
            productData.imageUrl = await snapshot.ref.getDownloadURL();
        }
        
        // Update product in Firestore
        await db.collection('products').doc(productId).update(productData);
        
        showStatusMessage('Product updated successfully', 'success');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
        if (modal) modal.hide();
        
        // Reload inventory
        loadInventory();
        
    } catch (error) {
        console.error('Error updating product:', error);
        showStatusMessage('Error updating product: ' + error.message, 'error');
    } finally {
        updateButton.textContent = originalText;
        updateButton.disabled = false;
    }
}

// Confirmation for deletion (Replaced confirm() with visual status message)
function confirmDeleteProduct(productId) {
    const product = inventory.find(p => p.id === productId);
    if (!product) return;

    showStatusMessage(`Are you sure you want to delete product: ${product.name}? Click the trash icon again within 5 seconds to confirm.`, 'warning');
    
    // Temporarily change the delete button's onclick to the actual delete function
    const deleteBtn = document.querySelector(`button[onclick="confirmDeleteProduct('${productId}')"]`);
    if (deleteBtn) {
        deleteBtn.onclick = () => deleteProduct(productId);
        
        // Revert the button action after 5 seconds if not clicked
        setTimeout(() => {
            // Only revert if the button hasn't been clicked/changed
            if (deleteBtn && deleteBtn.getAttribute('onclick').includes('deleteProduct')) {
                deleteBtn.onclick = () => confirmDeleteProduct(productId);
            }
        }, 5000);
    }
}

// Delete product
async function deleteProduct(productId) {
    try {
        // Find the product to get image reference
        const productToDelete = inventory.find(p => p.id === productId);

        // Delete product from Firestore
        await db.collection('products').doc(productId).delete();
        
        // Delete image from Storage (optional but good practice)
        if (productToDelete && productToDelete.imageUrl) {
             try {
                 const imageRef = firebase.storage().refFromURL(productToDelete.imageUrl);
                 await imageRef.delete();
                 console.log('Image deleted from storage.');
             } catch (storageError) {
                 // Log storage deletion error but continue with success message
                 console.warn('Could not delete image from Firebase Storage (might not exist or permission issue):', storageError);
             }
        }

        showStatusMessage('Product deleted successfully', 'success');
        loadInventory();
    } catch (error) {
        console.error('Error deleting product:', error);
        showStatusMessage('Error deleting product: ' + error.message, 'error');
    }
}

// Show status message (copied for self-containment)
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
window.confirmDeleteProduct = confirmDeleteProduct; // New confirmation step
