// inventario/static/inventario/js/conteo.js
document.addEventListener("DOMContentLoaded", function () {
    const zonaSelect = document.getElementById("zona");
    const subzonaSelect = document.getElementById("subzona");

    zonaSelect.addEventListener("change", function () {
        const zona = this.value;
        subzonaSelect.innerHTML = '<option value="">Cargando...</option>';

        fetch(`/subzonas/?zona=${zona}`)
            .then(response => response.json())
            .then(data => {
                subzonaSelect.innerHTML = '<option value="">-- Selecciona una subzona --</option>';
                data.subzonas.forEach(sub => {
                    const opt = document.createElement("option");
                    opt.value = sub.id;
                    opt.textContent = sub.nombre;
                    subzonaSelect.appendChild(opt);
                });
            })
            .catch(() => {
                subzonaSelect.innerHTML = '<option value="">Error al cargar subzonas</option>';
            });
    });

    const form = document.querySelector("form[method='POST']");
    if (form) {
        form.addEventListener("submit", function (e) {
            let error = false;
            let mensaje = "";
            let hayProductos = false;
            let hayComentario = false;

            const filas = document.querySelectorAll("tbody tr");

            filas.forEach(fila => {
                const cantidadInput = fila.querySelector("input[type='number']");
                const evidenciaInput = fila.querySelector("input[type='file']");
                const cantidad = cantidadInput?.value.trim();
                const evidencia = evidenciaInput?.files[0];

                if (cantidad && parseInt(cantidad) > 0) {
                    hayProductos = true;
                    if (!evidencia || evidencia.size <= 0) {
                        error = true;
                        mensaje = "Para cada producto con cantidad ingresada, debes adjuntar evidencia.";
                    }
                }
            });

            const comentario = document.querySelector("textarea[name='incidencia_comentario']")?.value.trim();
            const evidenciaComentarioInput = document.querySelector("input[name='incidencia_evidencia']");
            const evidenciaComentarioArchivo = evidenciaComentarioInput?.files[0];
            const evidenciaComentario = evidenciaComentarioArchivo && evidenciaComentarioArchivo.size > 0;

            if (comentario || evidenciaComentario) {
                hayComentario = true;
                if (!comentario || !evidenciaComentario) {
                    error = true;
                    mensaje = "Para reportar un producto no registrado, debes ingresar comentario y evidencia.";
                }
            }

            if (!hayProductos && !hayComentario) {
                e.preventDefault();
                alert("Debes ingresar al menos una cantidad con evidencia o un comentario con evidencia.");
                return;
            }

            if (error) {
                e.preventDefault();
                alert(mensaje);
            }
        });
    }
}); 