// Wallet Management Functions
let walletBalance = 0;
let transactions = [];

// Show Wallet Section
function showWallet() {
    hideAllSections();
    const walletSection = document.getElementById('walletSection');
    if (walletSection) walletSection.classList.add('active');
    updateActiveNavLink('showWallet');
    
    loadWalletData();
    setupWalletEventListeners();
}

function setupWalletEventListeners() {
    // Quick amount buttons
    document.querySelectorAll('.quick-amount-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const amount = this.getAttribute('data-amount');
            document.getElementById('addAmount').value = amount;
            
            // Update active state
            document.querySelectorAll('.quick-amount-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Clear active state when manually typing
    document.getElementById('addAmount').addEventListener('input', function() {
        document.querySelectorAll('.quick-amount-btn').forEach(b => b.classList.remove('active'));
    });
}

async function loadWalletData() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        // Load wallet balance
        const walletDoc = await db.collection('wallets').doc(user.uid).get();
        if (walletDoc.exists) {
            const walletData = walletDoc.data();
            walletBalance = walletData.balance || 0;
            transactions = walletData.transactions || [];
        } else {
            // Create wallet if it doesn't exist
            await db.collection('wallets').doc(user.uid).set({
                balance: 0,
                transactions: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        updateWalletUI();
    } catch (error) {
        console.error('Error loading wallet data:', error);
        showStatusMessage('Error loading wallet data', 'error');
    }
}

function updateWalletUI() {
    // Update balance display
    document.getElementById('walletBalance').textContent = `₹ ${walletBalance.toFixed(2)}`;
    
    // Update transaction list
    displayTransactions();
}

function displayTransactions() {
    const transactionList = document.getElementById('transactionList');
    if (!transactionList) return;

    if (transactions.length === 0) {
        transactionList.innerHTML = '<div class="text-center p-4">No transactions yet</div>';
        return;
    }

    // Sort transactions by date (newest first)
    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    transactionList.innerHTML = sortedTransactions.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-details">
                <div class="transaction-type ${transaction.type === 'credit' ? 'transaction-credit' : 'transaction-debit'}">
                    ${transaction.description}
                </div>
                <div class="transaction-date">
                    ${new Date(transaction.timestamp).toLocaleString()}
                </div>
                <div class="transaction-id">
                    ID: ${transaction.id}
                </div>
            </div>
            <div class="transaction-amount ${transaction.type === 'credit' ? 'transaction-credit' : 'transaction-debit'}">
                ${transaction.type === 'credit' ? '+' : '-'}₹${transaction.amount.toFixed(2)}
            </div>
            <div class="transaction-status status-${transaction.status}">
                ${transaction.status}
            </div>
        </div>
    `).join('');
}

// Add Money to Wallet using Razorpay
async function addMoneyToWallet() {
    const amountInput = document.getElementById('addAmount');
    const amount = parseFloat(amountInput.value);

    if (!amount || amount < 100) {
        showStatusMessage('Please enter a valid amount (minimum ₹100)', 'error');
        return;
    }

    try {
        // Create Razorpay order on your backend
        const orderResponse = await createRazorpayOrder(amount);
        
        const options = {
            key: RAZORPAY_KEY_ID,
            amount: orderResponse.amount,
            currency: "INR",
            name: "Lens Prescription App",
            description: `Add ₹${amount} to wallet`,
            order_id: orderResponse.id,
            handler: async function(response) {
                await handlePaymentSuccess(response, amount);
            },
            prefill: {
                name: auth.currentUser.displayName || "",
                email: auth.currentUser.email,
            },
            theme: {
                color: "#007bff"
            },
            modal: {
                ondismiss: function() {
                    showStatusMessage('Payment cancelled', 'warning');
                }
            }
        };

        const razorpay = new Razorpay(options);
        razorpay.open();
        
    } catch (error) {
        console.error('Payment initiation error:', error);
        showStatusMessage('Error initiating payment', 'error');
    }
}

// Create Razorpay Order (Backend API call)
async function createRazorpayOrder(amount) {
    // In a real implementation, this would call your backend API
    // For demo purposes, we'll simulate the response
    return {
        id: `order_${Date.now()}`,
        amount: amount * 100, // Razorpay expects amount in paise
        currency: "INR"
    };
}

// Handle Successful Payment
async function handlePaymentSuccess(paymentResponse, amount) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        // Verify payment with your backend
        const verificationResponse = await verifyPayment(paymentResponse);
        
        if (verificationResponse.success) {
            // Update wallet balance
            const transactionId = `txn_${Date.now()}`;
            const newTransaction = {
                id: transactionId,
                type: 'credit',
                amount: amount,
                description: 'Wallet Top-up',
                status: 'completed',
                timestamp: new Date().toISOString(),
                paymentId: paymentResponse.razorpay_payment_id,
                orderId: paymentResponse.razorpay_order_id
            };

            // Update wallet in Firestore
            await db.collection('wallets').doc(user.uid).update({
                balance: firebase.firestore.FieldValue.increment(amount),
                transactions: firebase.firestore.FieldValue.arrayUnion(newTransaction),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update local state
            walletBalance += amount;
            transactions.push(newTransaction);

            // Update UI
            updateWalletUI();
            showStatusMessage(`₹${amount} added to wallet successfully!`, 'success');
            
            // Clear input
            document.getElementById('addAmount').value = '';
            document.querySelectorAll('.quick-amount-btn').forEach(b => b.classList.remove('active'));
            
        } else {
            throw new Error('Payment verification failed');
        }
    } catch (error) {
        console.error('Payment processing error:', error);
        showStatusMessage('Payment processing failed', 'error');
    }
}

// Verify Payment (Backend API call)
async function verifyPayment(paymentResponse) {
    // In a real implementation, this would call your backend API to verify the payment signature
    // For demo purposes, we'll simulate successful verification
    return { success: true };
}

// Withdraw to Bank Account
async function withdrawToBank() {
    const amountInput = document.getElementById('withdrawAmount');
    const amount = parseFloat(amountInput.value);
    const accountNumber = document.getElementById('bankAccountNumber').value.trim();
    const ifscCode = document.getElementById('bankIFSC').value.trim();
    const accountHolderName = document.getElementById('accountHolderName').value.trim();

    // Validation
    if (!amount || amount < 100) {
        showStatusMessage('Please enter a valid amount (minimum ₹100)', 'error');
        return;
    }

    if (amount > 50000) {
        showStatusMessage('Maximum withdrawal amount is ₹50,000 per transaction', 'error');
        return;
    }

    if (amount > walletBalance) {
        showStatusMessage('Insufficient wallet balance', 'error');
        return;
    }

    if (!accountNumber || accountNumber.length < 9) {
        showStatusMessage('Please enter a valid bank account number', 'error');
        return;
    }

    if (!ifscCode || ifscCode.length !== 11) {
        showStatusMessage('Please enter a valid IFSC code', 'error');
        return;
    }

    if (!accountHolderName) {
        showStatusMessage('Please enter account holder name', 'error');
        return;
    }

    try {
        // Process withdrawal
        const withdrawalId = `withdrawal_${Date.now()}`;
        const withdrawalTransaction = {
            id: withdrawalId,
            type: 'debit',
            amount: amount,
            description: 'Bank Withdrawal',
            status: 'pending',
            timestamp: new Date().toISOString(),
            bankDetails: {
                accountNumber: accountNumber,
                ifscCode: ifscCode,
                accountHolderName: accountHolderName
            }
        };

        // Update wallet in Firestore
        await db.collection('wallets').doc(auth.currentUser.uid).update({
            balance: firebase.firestore.FieldValue.increment(-amount),
            transactions: firebase.firestore.FieldValue.arrayUnion(withdrawalTransaction),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update local state
        walletBalance -= amount;
        transactions.push(withdrawalTransaction);

        // Update UI
        updateWalletUI();
        showStatusMessage(`Withdrawal request for ₹${amount} submitted successfully!`, 'success');
        
        // Clear form
        document.getElementById('withdrawAmount').value = '';
        document.getElementById('bankAccountNumber').value = '';
        document.getElementById('bankIFSC').value = '';
        document.getElementById('accountHolderName').value = '';

        // In a real implementation, you would initiate the bank transfer via Razorpay Payouts API
        await initiateBankTransfer(withdrawalTransaction);

    } catch (error) {
        console.error('Withdrawal error:', error);
        showStatusMessage('Withdrawal failed', 'error');
    }
}

// Initiate Bank Transfer (Backend API call)
async function initiateBankTransfer(withdrawalTransaction) {
    // In a real implementation, this would call Razorpay Payouts API via your backend
    // For demo purposes, we'll simulate the process
    
    // Simulate processing delay
    setTimeout(async () => {
        try {
            // Update transaction status to completed
            const user = auth.currentUser;
            if (!user) return;

            // Find and update the transaction
            const walletDoc = await db.collection('wallets').doc(user.uid).get();
            const walletData = walletDoc.data();
            const updatedTransactions = walletData.transactions.map(txn => 
                txn.id === withdrawalTransaction.id 
                    ? { ...txn, status: 'completed' }
                    : txn
            );

            await db.collection('wallets').doc(user.uid).update({
                transactions: updatedTransactions,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update local state
            const transactionIndex = transactions.findIndex(t => t.id === withdrawalTransaction.id);
            if (transactionIndex !== -1) {
                transactions[transactionIndex].status = 'completed';
                updateWalletUI();
                showStatusMessage(`Withdrawal of ₹${withdrawalTransaction.amount} completed!`, 'success');
            }

        } catch (error) {
            console.error('Error updating withdrawal status:', error);
        }
    }, 3000); // Simulate 3 second processing time
}

// Export wallet functions for global access
window.showWallet = showWallet;
window.addMoneyToWallet = addMoneyToWallet;
window.withdrawToBank = withdrawToBank;
