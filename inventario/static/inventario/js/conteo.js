// inventario/static/inventario/js/conteo.js
document.addEventListener("DOMContentLoaded", function () {
    const zonaSelect = document.getElementById("zona");
    const subzonaSelect = document.getElementById("subzona");

    // Cargar subzonas cuando cambie la zona
    zonaSelect.addEventListener("change", function () {
        const zona = this.value;
        subzonaSelect.innerHTML = '<option value="">Cargando...</option>';

        fetch(`/subzonas/?zona=${zona}`)
            .then(response => response.json())
            .then(data => {
                subzonaSelect.innerHTML = '<option value="">-- Selecciona una subzona --</option>';
                data.subzonas.forEach(sub => {
                    const opt = document.createElement("option");
                    opt.value = sub.id; // ✅ Aquí enviamos el ID real
                    opt.textContent = sub.nombre; // Mostramos el nombre
                    subzonaSelect.appendChild(opt);
                });
            })
            .catch(() => {
                subzonaSelect.innerHTML = '<option value="">Error al cargar subzonas</option>';
            });
    });
});