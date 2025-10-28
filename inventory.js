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
                   
