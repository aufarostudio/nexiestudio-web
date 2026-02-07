const SLUG = 'polleria-uripa';
let currentBusiness = null;

document.addEventListener('DOMContentLoaded', async function () {
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
        .select('id, nombre, portada_url, perfil_url, direccion, hora_apertura, hora_cierre')
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

    const { data: products, error } = await _supabase
        .from('productos')
        .select('*')
        .eq('negocio_id', currentBusiness.id)
        .eq('activo', true)
        .eq('eliminado', false)
        .order('categoria', { ascending: true }); // Order by category roughly

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    renderMenu(products);
}

function renderMenu(products) {
    const container = document.getElementById('menu-container');
    container.innerHTML = '';

    if (!products || products.length === 0) {
        container.innerHTML = '<p class="center-align" style="margin-top:20px;">No hay productos disponibles por el momento.</p>';
        return;
    }

    // Group by Category
    const grouped = {};
    const defaultCategory = 'General';

    products.forEach(p => {
        let cat = defaultCategory;
        if (p.categoria) {
            // Take the first tag as the main category
            cat = p.categoria.split(',')[0].trim();
        }
        // Capitalize
        cat = cat.charAt(0).toUpperCase() + cat.slice(1);

        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    });

    // Render Groups
    Object.keys(grouped).forEach(category => {
        // Section Title
        const titleEl = document.createElement('h5');
        titleEl.className = 'category-title container';
        titleEl.innerText = category;
        container.appendChild(titleEl);

        // Products Container for this Category
        const sectionEl = document.createElement('div');
        sectionEl.className = 'container products-grid';

        grouped[category].forEach(product => {
            const card = createProductCard(product);
            sectionEl.appendChild(card);
        });

        container.appendChild(sectionEl);
    });
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
                    <i class="material-icons" style="font-size: 18px;">shopping_cart</i> Añadir
                </button>
            </div>
        </div>
    `;

    return div;
}

function addToCart(productId) {
    console.log('Add to cart:', productId);
    // Placeholder for interaction
    M.toast({ html: 'Producto añadido (Demo)', classes: 'rounded gradient-btn' });
}
