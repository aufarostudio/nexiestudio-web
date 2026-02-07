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

    // Initialize Selects
    const selects = document.querySelectorAll('select');
    M.FormSelect.init(selects);
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

window.loadCategorySelect = async function (selectedId = null) {
    const select = document.getElementById('categoriaSelect');
    console.log("selectedId: ", selectedId);
    // Default option
    select.innerHTML = '<option value="" disabled selected>Seleccionar</option>';

    try {
        if (!currentBusinessId) return;

        const { data, error } = await _supabase
            .from('categorias')
            .select('id, nombre')
            .eq('negocio_id', currentBusinessId)
            .eq('mostrar', true)
            .order('orden', { ascending: true });

        if (error) throw error;

        data.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id; // Use ID as value
            option.innerText = cat.nombre;

            // Check if this option should be selected
            // Use loose equality to match string/number differences
            if (selectedId && cat.id == selectedId) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        M.FormSelect.init(select);

    } catch (error) {
        console.error('Error cargando select de categorías:', error);
    }
};

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
        console.log("productosData: ", data);
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
        let imgUrl = product.imagen_url ? `${product.imagen_url}?t=${new Date().getTime()}` : 'https://placehold.co/100';
        const isChecked = product.activo ? 'checked' : '';

        row.innerHTML = `
            <td class="center-align" data-label="Mostrar">
                <label>
                    <input type="checkbox" ${isChecked} onchange="toggleActive('${product.id}', this.checked)" />
                    <span></span>
                </label>
            </td>
            <td data-label="Imagen"><img src="${imgUrl}" alt="${product.nombre}" class="product-img" onerror="this.src='https://placehold.co/100'"></td>
            <td data-label="Nombre"><strong>${product.nombre}</strong></td>
            <td class="truncate" style="max-width: 200px;" data-label="Descripción">${product.descripcion}</td>
            <td data-label="Precio">
                ${(product.tiene_descuento && product.precio_descuento > 0)
                ? `<span class="black-text">S/ ${parseFloat(product.precio_descuento).toFixed(2)}</span>
                       <br><span class="grey-text" style="text-decoration: line-through; font-size: 0.8em;">S/ ${parseFloat(product.price || product.precio).toFixed(2)}</span>`
                : `S/ ${parseFloat(product.price || product.precio).toFixed(2)}`
            }
            </td>
            <td class="center-align" data-label="Acciones">
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

async function prepareCreate() {
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

    // Load Categories FIRST
    await loadCategorySelect();

    // Reset Image Preview
    const preview = document.getElementById('imagePreview');
    preview.src = 'https://placehold.co/100';
    preview.style.display = 'none';

    M.updateTextFields();

    // Open Modal Programmatically
    const modal = M.Modal.getInstance(document.getElementById('productModal'));
    modal.open();
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

        // Load Categories FIRST, passing the current ID to select it
        const storedCatId = product.categoria_id || product.categoria;
        await loadCategorySelect(storedCatId);

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

        // Populate Select
        // Assuming 'categoria' stores comma separated string, we take the first one or just matches.
        // If DB stores "Bebidas, Comidas", we might only support single selection now with Select.
        // User requested "Select", implying single choice usually, or multiple. 
        // Materialize Select supports multiple but let's assume single for now based on "Category Input" replacement.
        // If the product has multiple categories, we might select the first one or handle multi-select.
        // Given the prompt said "change input... for a Select", single selection is safest assumption for "ordering".

        /*let currentCat = '';
        if (product.categoria) {
            currentCat = product.categoria.split(',')[0].trim();
        }*/
        //loadCategorySelect(currentCat);


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

    // Get Category from Select
    const categoriaSelect = document.getElementById('categoriaSelect');
    const categoria_id = categoriaSelect.value || null;
    let categoria = '';

    // Get Name for legacy support
    if (categoria_id) {
        const selectedOption = categoriaSelect.options[categoriaSelect.selectedIndex];
        if (selectedOption) {
            categoria = selectedOption.text;
        }
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
        console.log("categoria_id:", categoria_id);
        const commonData = {
            nombre,
            descripcion,
            precio,
            tiene_descuento,
            precio_descuento,
            mas_vendido,
            categoria_id, // Save ID
            categoria,    // Save Name (Legacy Support)
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

// --- Categories Management Logic ---

window.loadCategories = async function () {
    console.log('Cargando categorías...');
    const tableBody = document.getElementById('categoriesTableBody');
    tableBody.innerHTML = '<tr><td colspan="2" class="center-align">Cargando...</td></tr>';

    try {
        if (!currentBusinessId) throw new Error('No se ha cargado el negocio');

        const { data, error } = await _supabase
            .from('categorias')
            .select('*')
            .eq('negocio_id', currentBusinessId)
            .order('orden', { ascending: true });

        if (error) throw error;

        renderCategoriesTable(data);
    } catch (error) {
        console.error('Error cargando categorías:', error);
        tableBody.innerHTML = '<tr><td colspan="2" class="center-align red-text">Error al cargar categorías</td></tr>';
    }
};

function renderCategoriesTable(categories) {
    const tableBody = document.getElementById('categoriesTableBody');
    tableBody.innerHTML = '';

    if (!categories || categories.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="2" class="center-align">No hay categorías registradas.</td></tr>';
        return;
    }

    categories.forEach(cat => {
        const row = document.createElement('tr');
        // Checkbox state: checked if cat.mostrar is true
        const isChecked = cat.mostrar ? 'checked' : '';

        row.innerHTML = `
            <td data-label="Nombre">${cat.nombre}</td>
            <td class="center-align" data-label="Mostrar">
                <div class="switch">
                    <label>
                        <input type="checkbox" ${isChecked} onchange="toggleCategoryShow('${cat.id}', this.checked)">
                        <span class="lever"></span>
                    </label>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

window.toggleCategoryShow = async function (id, isVisible) {
    try {
        const { error } = await _supabase
            .from('categorias')
            .update({ mostrar: isVisible })
            .eq('id', id);

        if (error) throw error;
        M.toast({ html: isVisible ? 'Categoría visible' : 'Categoría oculta', classes: 'green rounded' });
    } catch (error) {
        console.error('Error actualizando categoría:', error);
        M.toast({ html: 'Error al actualizar: ' + error.message, classes: 'red rounded' });
        // Optional: Revert checkbox visual state if needed
    }
};

window.createCategory = async function () {
    const input = document.getElementById('newCategoryName');
    const nombre = input.value.trim();

    if (!nombre) {
        M.toast({ html: 'Ingresa un nombre para la categoría', classes: 'orange rounded' });
        return;
    }

    if (!currentBusinessId) {
        M.toast({ html: 'Error de negocio', classes: 'red rounded' });
        return;
    }

    try {
        // Insert new category
        const { data, error } = await _supabase
            .from('categorias')
            .insert([{
                nombre: nombre,
                negocio_id: currentBusinessId,
                mostrar: true // Default visible
            }])
            .select();

        if (error) throw error;

        M.toast({ html: 'Categoría creada exitosamente', classes: 'green rounded' });
        input.value = ''; // Clear input
        loadCategories(); // Reload table

    } catch (error) {
        console.error('Error creando categoría:', error);
        M.toast({ html: 'Error al crear: ' + error.message, classes: 'red rounded' });
    }
};
