// inventory.js - Inventory Management (Updated for Firebase Firestore and ImgBB for Images)

let IMGBB_API_KEY = null;
let inventory = [];

// Helper function to convert data URL to blob (Moved from app.js/recreated for reliability)
function dataURLToBlob(dataURL) {
    const parts = dataURL.split(';base64,');
    if (parts.length < 2) {
        // Handle case where it might not be a full data URL, fallback to binary-safe decode
        const mime = 'application/octet-stream';
        const raw = window.atob(dataURL);
        const uInt8Array = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        return new Blob([uInt8Array], { type: mime });
    }

    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const uInt8Array = new Uint8Array(raw.length);
    
    for (let i = 0; i < raw.length; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }
    
    return new Blob([uInt8Array], { type: contentType });
}

// Load ImgBB API Key
async function loadImgbbApiKey() {
    if (IMGBB_API_KEY) return;

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

// Upload image to ImgBB (REFACTORED to use Blob/File format)
async function uploadImageToImgBB(imageFile) {
    if (!imageFile) return null;
    if (!IMGBB_API_KEY || IMGBB_API_KEY === 'DISABLED') {
        throw new Error('Image upload key is unavailable. Check Netlify function/environment variable.');
    }
    
    // 1. Convert File to Data URL
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result); // Get full data URL
        reader.onerror = error => reject(error);
        reader.readAsDataURL(imageFile);
    });

    // 2. Convert Data URL to Blob/File object
    const imageBlob = dataURLToBlob(dataUrl);

    // 3. Create FormData and append the Blob/File object (Standard multipart upload)
    const formData = new FormData();
    // ImgBB requires the file to be under the 'image' field
    formData.append("image", imageBlob, imageFile.name); 

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: "POST",
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ImgBB upload failed with status ${response.status}. Response: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            return data.data.url;
        } else {
            throw new Error(data.error?.message || 'ImgBB upload failed due to API error');
        }
    } catch (error) {
        console.error('ImgBB upload error:', error);
        throw error;
    }
}

// Load inventory from Firestore
async function loadInventory() {
    try {
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
        
        if (imageFile) {
            imageUrl = await uploadImageToImgBB(imageFile);
            productData.imageUrl = imageUrl;
        }
        
        await db.collection('products').add(productData);
        
        showStatusMessage('Product added successfully', 'success');
        
        form.reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById('addProductModal'));
        if (modal) modal.hide();
        
        loadInventory();
        
    } catch (error) {
        console.error('Error adding product:', error);
        showStatusMessage('Error adding product: ' + (error.message || 'Check network connection or Netlify function.'), 'error');
    } finally {
        addButton.innerHTML = originalText;
        addButton.disabled = false;
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
    
    const editImageInput = document.getElementById('editProductImage');
    if (editImageInput) editImageInput.value = '';

    const modal = new bootstrap.Modal(document.getElementById('editProductModal'));
    modal.show();
}

// Update product
async function updateProduct() {
    const productId = document.getElementById('editProductId').value;

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
        if (imageFile) {
            productData.imageUrl = await uploadImageToImgBB(imageFile);
        }
        
        await db.collection('products').doc(productId).update(productData);
        
        showStatusMessage('Product updated successfully', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
        if (modal) modal.hide();
        
        loadInventory();
        
    } catch (error) {
        console.error('Error updating product:', error);
        showStatusMessage('Error updating product: ' + (error.message || 'Check network connection or Netlify function.'), 'error');
    } finally {
        updateButton.innerHTML = originalText;
        updateButton.disabled = false;
    }
}

// Confirmation for deletion
function confirmDeleteProduct(productId) {
    const product = inventory.find(p => p.id === productId);
    if (!product) return;

    showStatusMessage(`Are you sure you want to delete product: ${product.name}? Click the trash icon again within 5 seconds to confirm.`, 'warning');
    
    const deleteBtn = document.querySelector(`#deleteBtn-${productId}`);
    if (deleteBtn) {
        const originalOnclick = deleteBtn.getAttribute('onclick');
        
        deleteBtn.onclick = () => deleteProduct(productId);
        
        setTimeout(() => {
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
        await db.collection('products').doc(productId).delete();
        
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

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async function() {
    await loadImgbbApiKey();
});

// Make functions available globally
window.addProduct = addProduct;
window.editProduct = editProduct;
window.updateProduct = updateProduct;
window.deleteProduct = deleteProduct;
window.confirmDeleteProduct = confirmDeleteProduct;
window.loadInventory = loadInventory;
