// inventory.js - Inventory Management (Updated for Firebase Firestore and ImgBB for Images)

// NOTE: The API Key is now loaded dynamically from a Netlify function.
let IMGBB_API_KEY = null; 
let inventory = [];

// --- Initialization: Load API Key and Inventory ---

/**
 * Loads the ImgBB API key from the Netlify environment variable via a serverless function.
 */
async function loadImgbbApiKey() {
    if (IMGBB_API_KEY) return; // Already loaded

    try {
        const response = await fetch('/.netlify/functions/get-imgbb-key');
        if (!response.ok) {
            throw new Error('Failed to load ImgBB API key');
        }
        const data = await response.json();
        IMGBB_API_KEY = data.key;
        console.log('ImgBB API Key loaded successfully');
    } catch (error) {
        console.error('Error loading ImgBB API key:', error);
        showStatusMessage('Image upload temporarily unavailable', 'error');
        IMGBB_API_KEY = 'DISABLED';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async function() {
    await loadImgbbApiKey();
});

// --- ImgBB Image Handling Functions ---

/**
 * Uploads a File object to ImgBB using a FormData POST request.
 * @param {File} imageFile The product image file.
 * @returns {Promise<string>} The public URL of the uploaded image.
 */
async function uploadImageToImgBB(imageFile) {
    if (!imageFile) return null;
    if (!IMGBB_API_KEY || IMGBB_API_KEY === 'DISABLED') {
        throw new Error('Image upload key is unavailable.');
    }
    
    // Convert file to base64 for ImgBB API
    const base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(imageFile);
    });

    const formData = new FormData();
    formData.append("image", base64Image); // ImgBB expects the base64 string under 'image'

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST",
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`ImgBB upload failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
        return data.data.url;
    } else {
        throw new Error(data.error?.message || 'ImgBB upload failed due to API error');
    }
}

// NOTE: ImgBB does not offer an easy way to delete images via a simple URL.
// Deletion would require storing a separate 'delete_url' or 'delete_hash' 
// from the ImgBB response. Since we are not storing the delete hash, 
// we will only remove the image URL from Firestore. The remote image will remain.

// --- End ImgBB Image Handling Functions ---

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
                <button class="btn btn-sm btn-outline-danger" id="deleteBtn-${product.id}" onclick="confirmDeleteProduct('${product.id}')">
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
    const originalText = addButton.innerHTML; 
    addButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...';
    addButton.disabled = true;

    try {
        let imageUrl = '';
        
        // Upload image to ImgBB
        if (imageFile) {
            imageUrl = await uploadImageToImgBB(imageFile);
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
        showStatusMessage('Error adding product: ' + (error.message || 'Check network connection or Netlify function.'), 'error');
    } finally {
        addButton.innerHTML = originalText;
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
    
    // Clear the file input when opening the modal
    const editImageInput = document.getElementById('editProductImage');
    if (editImageInput) editImageInput.value = '';

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
    const originalText = updateButton.innerHTML;
    updateButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...';
    updateButton.disabled = true;

    try {
        // Upload new image to ImgBB
        if (imageFile) {
            productData.imageUrl = await uploadImageToImgBB(imageFile);
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
        showStatusMessage('Error updating product: ' + (error.message || 'Check network connection or Netlify function.'), 'error');
    } finally {
        updateButton.innerHTML = originalText;
        updateButton.disabled = false;
    }
}

// Confirmation for deletion (Replaced confirm() with visual status message)
function confirmDeleteProduct(productId) {
    const product = inventory.find(p => p.id === productId);
    if (!product) return;

    showStatusMessage(`Are you sure you want to delete product: ${product.name}? Click the trash icon again within 5 seconds to confirm.`, 'warning');
    
    // Temporarily change the delete button's onclick to the actual delete function
    const deleteBtn = document.querySelector(`#deleteBtn-${productId}`);
    if (deleteBtn) {
        // Store original onclick string to revert later if needed
        const originalOnclick = deleteBtn.getAttribute('onclick');
        
        // Update the button's action to call the deletion function directly
        deleteBtn.onclick = () => deleteProduct(productId);
        
        // Revert the button action after 5 seconds if not clicked
        setTimeout(() => {
            // Check if the button is still in the confirmation state (i.e., its current onclick is still the direct deleteProduct call)
            if (deleteBtn && deleteBtn.getAttribute('onclick') === `deleteProduct('${productId}')`) {
                 deleteBtn.setAttribute('onclick', originalOnclick);
            }
        }, 5000);
    }
}

// Delete product
async function deleteProduct(productId) {
    const deleteBtn = document.querySelector(`#deleteBtn-${productId}`);
    const originalContent = deleteBtn ? deleteBtn.innerHTML : '';
    
    if (deleteBtn) {
        deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
        deleteBtn.disabled = true;
    }
    
    try {
        // Delete product from Firestore
        await db.collection('products').doc(productId).delete();
        
        // NOTE: We skip attempting to delete the image from ImgBB 
        // because we don't store the necessary delete hash.
        
        showStatusMessage('Product deleted successfully', 'success');
        loadInventory();
    } catch (error) {
        console.error('Error deleting product:', error);
        showStatusMessage('Error deleting product: ' + (error.message || 'Check network connection or Netlify function.'), 'error');
    } finally {
        if (deleteBtn) {
             deleteBtn.innerHTML = originalContent;
             deleteBtn.disabled = false;
        }
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
