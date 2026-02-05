document.addEventListener('DOMContentLoaded', async function () {
    // Initialize Materialize Components
    M.AutoInit();

    // Check Session
    const session = await auth.checkSession();
    if (!session) {
        window.location.href = '../login/index.html';
        return;
    }

    // Get User and Business
    await loadBusinessLogic();

    // File Input Listener
    document.getElementById('imageFile').addEventListener('change', handleFileSelect);

    // Discount Toggle Listener
    document.getElementById('tiene_descuento').addEventListener('change', toggleDiscountInput);

    // Initialize Chips (Categories)
    const chipsElem = document.getElementById('categoriasChips');
    window.categoriesChipsInstance = M.Chips.init(chipsElem, {
        placeholder: 'Categorías +Enter',
        secondaryPlaceholder: '+Categoría',
        limit: 3,
        data: []
    });
});

let currentBusinessId = null;

function toggleDiscountInput() {
    const hasDiscount = document.getElementById('tiene_descuento').checked;
    const discountInput = document.getElementById('precio_descuento');
    discountInput.disabled = !hasDiscount;
    if (!hasDiscount) {
        discountInput.value = '';
        discountInput.classList.remove('valid', 'invalid');
        M.updateTextFields();
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('imagePreview');

    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.style.display = 'inline-block';
        };
        reader.readAsDataURL(file);
    }
}

async function loadBusinessLogic() {
    const tableBody = document.getElementById('productsTableBody');

    try {
        const user = await auth.getUser();
        if (!user) {
            throw new Error('No se pudo obtener el usuario');
        }

        // Fetch Business from 'negocios' table using user.id
        const { data: businessData, error: businessError } = await _supabase
            .from('negocios')
            .select('id')
            .eq('usuario_id', user.id)
            .maybeSingle(); // Use maybeSingle to avoid 406 if no rows

        if (businessError) {
            throw businessError;
        }

        if (!businessData) {
            console.warn('Este usuario no tiene un negocio asignado.');
            M.toast({ html: 'Usuario sin negocio asignado.', classes: 'orange rounded' });
            tableBody.innerHTML = '<tr><td colspan="6" class="center-align orange-text">No tienes un negocio registrado.</td></tr>';
            // Disable add button
            document.querySelector('.fixed-action-btn').style.display = 'none';
            return;
        }

        currentBusinessId = businessData.id;
        console.log('Negocio ID:', currentBusinessId);

        // Now load products for this business
        loadProducts();

    } catch (error) {
        console.error('Error cargando información del negocio:', error);
        M.toast({ html: 'Error cargando datos del negocio', classes: 'red rounded' });
    }
}

async function loadProducts() {
    const tableBody = document.getElementById('productsTableBody');
    tableBody.innerHTML = '<tr><td colspan="6" class="center-align">Cargando productos...</td></tr>';

    try {
        if (!currentBusinessId) return;

        const { data, error } = await _supabase
            .from('productos')
            .select('*')
            .eq('negocio_id', currentBusinessId) // Filter by Business ID
            .eq('eliminado', false) // Soft Delete Filter
            .order('id', { ascending: true });

        if (error) throw error;

        renderTable(data);
    } catch (error) {
        console.error('Error cargando productos:', error);
        tableBody.innerHTML = '<tr><td colspan="6" class="center-align red-text">Error al cargar productos</td></tr>';
    }
}

function renderTable(products) {
    const tableBody = document.getElementById('productsTableBody');
    tableBody.innerHTML = '';

    if (!products || products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="center-align">No hay productos activos. Agrega uno nuevo.</td></tr>';
        return;
    }

    products.forEach(product => {
        const row = document.createElement('tr');
        // Handle image: check if it's a valid URL, else placeholder
        const imgUrl = product.imagen_url || 'https://placehold.co/100';
        const isChecked = product.activo ? 'checked' : '';

        row.innerHTML = `
            <td class="center-align">
                <label>
                    <input type="checkbox" ${isChecked} onchange="toggleActive('${product.id}', this.checked)" />
                    <span></span>
                </label>
            </td>
            <td><img src="${imgUrl}" alt="${product.nombre}" class="product-img" onerror="this.src='https://placehold.co/100'"></td>
            <td><strong>${product.nombre}</strong></td>
            <td class="truncate" style="max-width: 200px;">${product.descripcion}</td>
            <td>$${parseFloat(product.price || product.precio).toFixed(2)}</td>
            <td class="center-align">
                <a class="btn-small waves-effect waves-light blue action-btn" onclick="editProduct('${product.id}')">
                    <i class="material-icons">edit</i>
                </a>
                <a class="btn-small waves-effect waves-light red action-btn" onclick="deleteProduct('${product.id}')">
                    <i class="material-icons">delete</i>
                </a>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Save to window for edit access easily if needed
    window.currentProducts = products;
}

async function toggleActive(id, isActive) {
    try {
        const { error } = await _supabase
            .from('productos')
            .update({ activo: isActive })
            .eq('id', id);

        if (error) throw error;
        M.toast({ html: isActive ? 'Producto activado' : 'Producto desactivado', classes: 'green rounded' });
    } catch (error) {
        console.error('Error cambiando estado:', error);
        M.toast({ html: 'Error al cambiar estado: ' + error.message, classes: 'red rounded' });
        // Revert checkbox state visuals if needed, but reloading is safer or just warn user
        loadProducts();
    }
}

// Modal State
let isEditing = false;
let editingId = null;

function prepareCreate() {
    isEditing = false;
    editingId = null;
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('modalTitle').innerText = 'Nuevo Producto';

    // Reset inputs
    document.getElementById('tiene_descuento').checked = false;
    document.getElementById('precio_descuento').value = '';
    document.getElementById('precio_descuento').disabled = true;
    document.getElementById('mas_vendido').checked = false;

    // Reset Chips
    if (window.categoriesChipsInstance) {
        // Destroy old instance and re-init to clear
        const chipsElem = document.getElementById('categoriasChips');
        window.categoriesChipsInstance.destroy();
        window.categoriesChipsInstance = M.Chips.init(chipsElem, {
            placeholder: 'Categorías +Enter',
            secondaryPlaceholder: '+Categoría',
            limit: 3,
            data: []
        });
    }

    // Reset Image Preview
    const preview = document.getElementById('imagePreview');
    preview.src = 'https://placehold.co/100';
    preview.style.display = 'none';

    M.updateTextFields();
}

// Need to expose this globally because it's called from HTML string
window.editProduct = async function (id) {
    // Show loading feedback
    M.toast({ html: 'Cargando datos del producto...', classes: 'blue rounded' });

    try {
        const { data: product, error } = await _supabase
            .from('productos')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!product) throw new Error('Producto no encontrado');

        isEditing = true;
        editingId = id;

        document.getElementById('modalTitle').innerText = 'Editar Producto';
        document.getElementById('productId').value = product.id;
        document.getElementById('name').value = product.nombre;
        document.getElementById('description').value = product.descripcion;
        document.getElementById('price').value = product.precio;

        // Populate new fields
        document.getElementById('tiene_descuento').checked = product.tiene_descuento || false;
        document.getElementById('mas_vendido').checked = product.mas_vendido || false;

        const discountInput = document.getElementById('precio_descuento');
        if (product.tiene_descuento) {
            discountInput.value = product.precio_descuento;
            discountInput.disabled = false;
        } else {
            discountInput.value = '';
            discountInput.disabled = true;
        }

        // Populate Chips
        const chipsElem = document.getElementById('categoriasChips');
        if (window.categoriesChipsInstance) window.categoriesChipsInstance.destroy();

        let chipsData = [];
        if (product.categoria) {
            // Split by comma and trim
            chipsData = product.categoria.split(',').map(tag => ({ tag: tag.trim() }));
        }

        window.categoriesChipsInstance = M.Chips.init(chipsElem, {
            placeholder: 'Categorías +Enter',
            secondaryPlaceholder: '+Categoría',
            limit: 3,
            data: chipsData
        });


        // Show existing image
        const preview = document.getElementById('imagePreview');
        if (product.imagen_url) {
            preview.src = product.imagen_url;
            preview.style.display = 'inline-block';
        } else {
            preview.style.display = 'none';
        }

        // Reset file input (user only uses it if replacing)
        document.getElementById('imageFile').value = '';
        document.querySelector('.file-path').value = '';

        M.updateTextFields();
        M.textareaAutoResize(document.getElementById('description'));

        const modal = M.Modal.getInstance(document.getElementById('productModal'));
        modal.open();

    } catch (error) {
        console.error('Error al cargar producto para editar:', error);
        M.toast({ html: 'Error al cargar datos del producto', classes: 'red rounded' });
    }
};

window.saveProduct = async function () {
    const nombre = document.getElementById('name').value.trim();
    const descripcion = document.getElementById('description').value.trim();
    const precio = parseFloat(document.getElementById('price').value);
    const fileInput = document.getElementById('imageFile');
    const file = fileInput.files[0];

    // New fields
    const tiene_descuento = document.getElementById('tiene_descuento').checked;
    const precio_descuento_val = document.getElementById('precio_descuento').value;
    const mas_vendido = document.getElementById('mas_vendido').checked;

    // Get Categories from Chips
    let categoria = '';
    if (window.categoriesChipsInstance) {
        const chips = window.categoriesChipsInstance.chipsData; // Array of objects {tag: 'foo'}
        categoria = chips.map(c => c.tag).join(',');
    }

    // Validation
    if (!nombre || !descripcion || isNaN(precio)) {
        M.toast({ html: 'Nombre, Descripción y Precio son obligatorios.', classes: 'red rounded' });
        return;
    }

    let precio_descuento = null;
    if (tiene_descuento) {
        if (!precio_descuento_val || isNaN(parseFloat(precio_descuento_val))) {
            M.toast({ html: 'Si tiene descuento, debes ingresar el precio con descuento.', classes: 'red rounded' });
            return;
        }
        precio_descuento = parseFloat(precio_descuento_val);
    }

    if (!isEditing && !file) {
        M.toast({ html: 'Debes subir una imagen para el producto nuevo.', classes: 'red rounded' });
        return;
    }

    if (!currentBusinessId) {
        M.toast({ html: 'Error crítico: No se encontró ID de negocio.', classes: 'red rounded' });
        return;
    }

    // Loading state
    const saveBtn = document.querySelector('#productModal .modal-footer .btn');
    const originalText = saveBtn.innerText;
    saveBtn.innerText = 'Guardando...';
    saveBtn.classList.add('disabled');

    try {
        let finalImageUrl = null;
        let productIdToUse = editingId;

        const commonData = {
            nombre,
            descripcion,
            precio,
            tiene_descuento,
            precio_descuento,
            mas_vendido,
            categoria,
            negocio_id: currentBusinessId,
            activo: true, // Default active on create
            eliminado: false // Default not deleted
        };

        // 1. If NEW, insert record first to get ID (needed for path)
        if (!isEditing) {
            const { data: newProd, error: insertError } = await _supabase
                .from('productos')
                .insert([commonData])
                .select()
                .single();

            if (insertError) throw insertError;
            productIdToUse = newProd.id;
        }

        // 2. Upload Image if file exists
        if (file) {
            const filePath = `${currentBusinessId}/${productIdToUse}`; // Path: negocio/producto

            const { data: uploadData, error: uploadError } = await _supabase
                .storage
                .from('productos') // Bucket Name
                .upload(filePath, file, {
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: urlData } = _supabase
                .storage
                .from('productos')
                .getPublicUrl(filePath);

            finalImageUrl = urlData.publicUrl;
        }

        // 3. Update Record with Image URL (and other fields if Edit)
        const updateData = {};
        if (finalImageUrl) updateData.imagen_url = finalImageUrl;

        if (isEditing) {
            // Update all fields for edit
            // Don't overwrite activo/eliminado on edit unless specifically intended (logic here preserves existing generally, but commonData has them fixed)
            // Wait, commonData has fix valyes. We should not overwrite activo status on edit of details.
            // Let's remove activo/eliminado from commonData for Edit.
            const { activo, eliminado, ...editData } = commonData;
            Object.assign(updateData, editData);

            const { error: updateError } = await _supabase
                .from('productos')
                .update(updateData)
                .eq('id', productIdToUse);

            if (updateError) throw updateError;
            M.toast({ html: 'Producto actualizado', classes: 'green rounded' });

        } else if (finalImageUrl) {
            // Update NEW product with image URL
            const { error: updateNewError } = await _supabase
                .from('productos')
                .update({ imagen_url: finalImageUrl })
                .eq('id', productIdToUse);

            if (updateNewError) throw updateNewError;
            M.toast({ html: 'Producto creado', classes: 'green rounded' });
        } else {
            // New product created but no image uploaded? 
            M.toast({ html: 'Producto creado', classes: 'green rounded' });
        }

        loadProducts();

        // Close modal
        const modal = M.Modal.getInstance(document.getElementById('productModal'));
        modal.close();

    } catch (error) {
        console.error('Error guardando:', error);
        M.toast({ html: 'Error al guardar: ' + error.message, classes: 'red rounded' });
    } finally {
        saveBtn.innerText = originalText;
        saveBtn.classList.remove('disabled');
    }
};

window.deleteProduct = async function (id) {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
        try {
            // Soft Delete: update eliminado = true
            const { error } = await _supabase
                .from('productos')
                .update({ eliminado: true })
                .eq('id', id);

            if (error) throw error;

            M.toast({ html: 'Producto eliminado', classes: 'orange rounded' });
            loadProducts();
        } catch (error) {
            console.error('Error eliminando:', error);
            M.toast({ html: 'Error al eliminar: ' + error.message, classes: 'red rounded' });
        }
    }
};
