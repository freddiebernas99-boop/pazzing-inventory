/**
 * PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
 * Vanilla JS Client-Side Helpers (Responsive & Mobile-First)
 */

document.addEventListener('DOMContentLoaded', function () {
    // 1. Mobile Menu Toggle
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    if (navToggle && navLinks) {
        navToggle.addEventListener('click', function () {
            navLinks.classList.toggle('open');
        });
    }

    // 2. Quantity Stepper (+ / - buttons) for fast phone touch input
    document.querySelectorAll('.qty-stepper').forEach(function (stepper) {
        const input = stepper.querySelector('.qty-input');
        const minusBtn = stepper.querySelector('.btn-minus');
        const plusBtn = stepper.querySelector('.btn-plus');

        if (input && minusBtn && plusBtn) {
            minusBtn.addEventListener('click', function (e) {
                e.preventDefault();
                let current = parseFloat(input.value) || 0;
                if (current > 0) {
                    input.value = Math.max(0, current - 1);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });

            plusBtn.addEventListener('click', function (e) {
                e.preventDefault();
                let current = parseFloat(input.value) || 0;
                input.value = current + 1;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
        }
    });

    // 3. Dynamic Calculation for Sales Forms (Water and Laundry)
    const salesForm = document.getElementById('salesTransactionForm');
    if (salesForm) {
        function recalculateTotals() {
            let grandTotal = 0;
            document.querySelectorAll('.item-row').forEach(function (row) {
                const qtyInput = row.querySelector('.item-qty');
                const rateInput = row.querySelector('.item-rate');
                const subtotalDisplay = row.querySelector('.item-subtotal');

                const qty = parseFloat(qtyInput ? qtyInput.value : 0) || 0;
                const rate = parseFloat(rateInput ? rateInput.value : 0) || 0;
                const subtotal = qty * rate;

                if (subtotalDisplay) {
                    subtotalDisplay.textContent = '₱' + subtotal.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                }
                grandTotal += subtotal;
            });

            const totalDisplay = document.getElementById('grandTotalDisplay');
            const totalInput = document.getElementById('grandTotalInput');
            if (totalDisplay) {
                totalDisplay.textContent = '₱' + grandTotal.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }
            if (totalInput) {
                totalInput.value = grandTotal.toFixed(2);
            }
        }

        salesForm.addEventListener('input', recalculateTotals);
        recalculateTotals(); // Initial calculation
    }

    // 4. Dynamic Expense Calculation (Qty * Unit Price)
    const expenseForm = document.getElementById('expenseForm');
    if (expenseForm) {
        const qtyInput = document.getElementById('expenseQty');
        const priceInput = document.getElementById('expensePrice');
        const totalInput = document.getElementById('expenseTotal');

        function updateExpenseTotal() {
            const qty = parseFloat(qtyInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;
            if (qty > 0 && price > 0) {
                totalInput.value = (qty * price).toFixed(2);
            }
        }

        if (qtyInput && priceInput) {
            qtyInput.addEventListener('input', updateExpenseTotal);
            priceInput.addEventListener('input', updateExpenseTotal);
        }
    }
});
