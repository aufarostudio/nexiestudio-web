const SLUG = 'polleria-uripa';
let currentBusiness = null;
let currentProducts = [];
let cart = [];

document.addEventListener('DOMContentLoaded', async function () {
    // Initialize modals
    var elems = document.querySelectorAll('.modal');
    M.Modal.init(elems);

    await initMenu();
});

async function initMenu() {
    try {
        await loadBusiness();
        if (currentBusiness) {
            await loadMenuProducts();
        }
    } catch (error) {
        console.error('Error initializing menu:', error);
        alert('Error cargando la carta digital.');
    } finally {
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

async function loadBusiness() {
    // Basic Supabase call - assuming _supabase is available globally via script tag
    // If not, we might need to initialize it here or ensure the shared script is loaded.
    // The shared script is imported in index.html, so _supabase should be available.

    const { data, error } = await _supabase
        .from('negocios')
        .select('id, nombre, portada_url, perfil_url, direccion, hora_apertura, hora_cierre, telefono_whatsapp')
        .eq('slug', SLUG)
        .single();

    if (error) {
        console.error('Error fetching business:', error);
        document.getElementById('business-name').innerText = 'Negocio no encontrado';
        return;
    }

    currentBusiness = data;

    // Update UI
    if (currentBusiness.portada_url) {
        document.getElementById('hero-img').src = currentBusiness.portada_url;
    }
    if (currentBusiness.perfil_url) {
        document.getElementById('profile-img').src = currentBusiness.perfil_url;
    }
    document.getElementById('business-name').innerText = currentBusiness.nombre;
    document.title = `Carta Digital - ${currentBusiness.nombre}`;

    // Render Details (Address, Hours, Status)
    renderBusinessDetails(currentBusiness);
}

function renderBusinessDetails(business) {
    const container = document.querySelector('.profile-container');

    // Check if details container exists, else create
    let detailsDiv = document.getElementById('business-info');
    if (!detailsDiv) {
        detailsDiv = document.createElement('div');
        detailsDiv.id = 'business-info';
        detailsDiv.className = 'business-details';
        container.appendChild(detailsDiv);
    }

    // Logic for Open/Closed
    let statusHtml = '';
    if (business.hora_apertura && business.hora_cierre) {
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTimeVal = currentHours * 60 + currentMinutes;

        // Parse DB times (HH:MM:SS)
        const [openH, openM] = business.hora_apertura.split(':').map(Number);
        const [closeH, closeM] = business.hora_cierre.split(':').map(Number);

        const openTimeVal = openH * 60 + openM;
        const closeTimeVal = closeH * 60 + closeM;

        let isOpen = false;
        if (closeTimeVal < openTimeVal) {
            // Ovenight (e.g. 18:00 to 02:00)
            isOpen = currentTimeVal >= openTimeVal || currentTimeVal < closeTimeVal;
        } else {
            // Normal day (e.g. 08:00 to 20:00)
            isOpen = currentTimeVal >= openTimeVal && currentTimeVal < closeTimeVal;
        }

        const statusText = isOpen ? 'Abierto' : 'Cerrado';
        const statusClass = isOpen ? 'status-open' : 'status-closed';
        statusHtml = `<span class="status-tag ${statusClass}">${statusText}</span>`;
    }

    // Convert to 12-hour format
    const formatTime = (time) => {
        if (!time) return '';
        const [h, m] = time.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${m} ${ampm}`;
    };

    const address = business.direccion || '';
    const hours = (business.hora_apertura && business.hora_cierre)
        ? `${formatTime(business.hora_apertura)} - ${formatTime(business.hora_cierre)}`
        : '';

    detailsDiv.innerHTML = `
        ${address ? `<p><i class="tiny material-icons">location_on</i> ${address}</p>` : ''}
        ${hours ? `<p><i class="tiny material-icons">access_time</i> ${hours}</p>` : ''}
        ${statusHtml}
    `;
}

async function loadMenuProducts() {
    if (!currentBusiness.id) return;

    // 1. Fetch active categories for this business, ordered by 'orden'
    const { data: categories, error: catError } = await _supabase
        .from('categorias')
        .select('*')
        .eq('negocio_id', currentBusiness.id)
        .eq('mostrar', true)
        .order('orden', { ascending: true });

    if (catError) {
        console.error('Error fetching categories:', catError);
        return;
    }

    // 2. Fetch active products for this business
    const { data: products, error: prodError } = await _supabase
        .from('productos')
        .select('*')
        .eq('negocio_id', currentBusiness.id)
        .eq('activo', true)
        .eq('eliminado', false)
        .order('orden', { ascending: true });

    if (prodError) {
        console.error('Error fetching products:', prodError);
        return;
    }

    currentProducts = products;
    renderMenu(categories, products);
}

function renderMenu(categories, products) {
    const container = document.getElementById('menu-container');
    container.innerHTML = '';

    if (!categories || categories.length === 0 || !products || products.length === 0) {
        container.innerHTML = '<p class="center-align" style="margin-top:20px;">No hay productos disponibles por el momento.</p>';
        return;
    }

    // Render by Category based on ordering from the 'categorias' table
    categories.forEach(category => {
        // Filter products that belong to this category
        // Support legacy 'categoria' string if 'categoria_id' is null
        const categoryProducts = products.filter(p =>
            p.categoria_id === category.id || (!p.categoria_id && p.categoria === category.nombre)
        );

        // Only render section if it has products inside
        if (categoryProducts.length > 0) {
            // Section Title
            const titleEl = document.createElement('h5');
            titleEl.className = 'category-title container';
            titleEl.innerText = category.nombre;
            container.appendChild(titleEl);

            // Products Container for this Category
            const sectionEl = document.createElement('div');
            sectionEl.className = 'container products-grid';

            categoryProducts.forEach(product => {
                const card = createProductCard(product);
                sectionEl.appendChild(card);
            });

            container.appendChild(sectionEl);
        }
    });

    // Handle "orphaned" products that don't match any active category
    const orphanedProducts = products.filter(p =>
        !categories.some(c => c.id === p.categoria_id || (!p.categoria_id && c.nombre === p.categoria))
    );

    if (orphanedProducts.length > 0) {
        const titleEl = document.createElement('h5');
        titleEl.className = 'category-title container';
        titleEl.innerText = 'Otros'; // Fallback category title
        container.appendChild(titleEl);

        const sectionEl = document.createElement('div');
        sectionEl.className = 'container products-grid';

        orphanedProducts.forEach(product => {
            const card = createProductCard(product);
            sectionEl.appendChild(card);
        });

        container.appendChild(sectionEl);
    }
}

function createProductCard(product) {
    const div = document.createElement('div');
    div.className = 'product-card';
    div.style.position = 'relative';

    const imgUrl = product.imagen_url || 'https://placehold.co/150';

    // Price Logic
    let priceHtml = '';
    if (product.tiene_descuento && product.precio_descuento > 0) {
        priceHtml = `
            <div class="price-container">
                <span class="original-price">S/ ${parseFloat(product.precio).toFixed(2)}</span>
                <span class="final-price">S/ ${parseFloat(product.precio_descuento).toFixed(2)}</span>
            </div>
        `;
    } else {
        priceHtml = `
            <div class="price-container">
                <span class="final-price">S/ ${parseFloat(product.precio).toFixed(2)}</span>
            </div>
        `;
    }

    // Badge
    let badgeHtml = '';
    if (product.mas_vendido) {
        badgeHtml = `<div class="best-seller-badge">Más Vendido</div>`;
    }

    div.innerHTML = `
        ${badgeHtml}
        <div class="product-img-container">
            <img src="${imgUrl}" alt="${product.nombre}" class="product-img" onerror="this.src='https://placehold.co/150'">
        </div>
        <div class="product-content">
            <div>
                <h3 class="product-title">${product.nombre}</h3>
                <p class="product-desc">${product.descripcion}</p>
            </div>
            <div class="price-row">
                ${priceHtml}
                <button class="add-btn" onclick="addToCart('${product.id}')">
                    + <i class="material-icons" style="font-size: 16px;">shopping_cart</i>
                </button>
            </div>
        </div>
    `;

    return div;
}

function addToCart(productId) {
    const product = currentProducts.find(p => p.id === productId);
    if (!product) return;

    // Determine the real price (discounted or original)
    const price = (product.tiene_descuento && product.precio_descuento > 0)
        ? parseFloat(product.precio_descuento)
        : parseFloat(product.precio);

    // Check if already in cart
    const existingItemIndex = cart.findIndex(item => item.product.id === productId);

    if (existingItemIndex !== -1) {
        cart[existingItemIndex].quantity += 1;
    } else {
        cart.push({
            product: product,
            price: price,
            quantity: 1
        });
    }

    renderCart();
    M.toast({ html: 'Producto añadido', classes: 'rounded gradient-btn' });
}

function updateCartQuantity(index, delta) {
    if (index >= 0 && index < cart.length) {
        cart[index].quantity += delta;

        // Minimum quantity is 1 while in cart
        if (cart[index].quantity < 1) {
            cart[index].quantity = 1;
        }

        renderCart();
    }
}

function removeFromCart(index) {
    if (index >= 0 && index < cart.length) {
        cart.splice(index, 1);
        renderCart();
    }
}

function openCart() {
    var modal = M.Modal.getInstance(document.getElementById('cartModal'));
    if (modal) modal.open();
}

function renderCart() {
    const qtyBadge = document.getElementById('cart-qty-badge');
    const floatingTotal = document.getElementById('cart-floating-total');
    const floatingCart = document.getElementById('floating-cart');

    const itemsContainer = document.getElementById('cart-items-container');
    const modalTotal = document.getElementById('cart-modal-total');

    let totalQty = 0;
    let totalPrice = 0;

    itemsContainer.innerHTML = '';

    if (cart.length === 0) {
        floatingCart.style.display = 'none';
        itemsContainer.innerHTML = '<li class="collection-item center-align" style="padding: 20px; color: #777;">Tu carrito está vacío</li>';
        modalTotal.innerText = 'S/ 0.00';

        // Auto close modal if empty
        var modal = M.Modal.getInstance(document.getElementById('cartModal'));
        if (modal && modal.isOpen) modal.close();
        return;
    }

    // Render Items
    cart.forEach((item, index) => {
        totalQty += item.quantity;
        totalPrice += (item.price * item.quantity);

        const li = document.createElement('li');
        li.className = 'collection-item cart-item';

        li.innerHTML = `
            <div class="cart-item-details">
                <p class="cart-item-title">${item.product.nombre}</p>
                <p class="cart-item-price">S/ ${item.price.toFixed(2)}</p>
            </div>
            <div class="cart-item-actions">
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateCartQuantity(${index}, -1)">
                        <i class="material-icons">remove</i>
                    </button>
                    <span class="qty-display">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateCartQuantity(${index}, 1)">
                        <i class="material-icons">add</i>
                    </button>
                </div>
                <button class="remove-item-btn" onclick="removeFromCart(${index})">
                    <i class="material-icons">delete_outline</i>
                </button>
            </div>
        `;
        itemsContainer.appendChild(li);
    });

    // Update Totals UI
    floatingCart.style.display = 'flex';
    qtyBadge.innerText = totalQty;
    floatingTotal.innerText = `S/ ${totalPrice.toFixed(2)}`;
    modalTotal.innerText = `S/ ${totalPrice.toFixed(2)}`;
}

function checkout() {
    if (cart.length === 0) {
        M.toast({ html: 'Tu carrito está vacío', classes: 'rounded red' });
        return;
    }

    // Get Payment Method
    let paymentMethod = 'Efectivo';
    const paymentRadios = document.getElementsByName('payment_method');
    for (let radio of paymentRadios) {
        if (radio.checked) {
            paymentMethod = radio.value;
            break;
        }
    }

    let totalPrice = 0;

    // Build WhatsApp Message
    let message = `Hola, quisiera hacer un pedido:\n\n`;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        totalPrice += itemTotal;
        message += `- ${item.quantity}x ${item.product.nombre} (S/ ${item.price.toFixed(2)})\n`;
    });

    message += `\nMétodo de pago: *${paymentMethod}*\n`;
    message += `*Total: S/ ${totalPrice.toFixed(2)}*\n\n`;
    message += `Gracias.`;

    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = currentBusiness.telefono_whatsapp || "51951278429";

    const waUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    window.open(waUrl, '_blank');
}
