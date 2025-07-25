// inventario/static/inventario/ja/conteo.js
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
            let hayProductoValido = false;
            let cantidadSinEvidencia = false;

            const filas = document.querySelectorAll("tbody tr");
            filas.forEach(fila => {
                const cantidadInput = fila.querySelector("input[type='number']");
                const evidenciaInput = fila.querySelector("input[type='file']");
                const cantidad = cantidadInput?.value.trim();
                const evidencia = evidenciaInput?.files[0];

                if (cantidad && parseInt(cantidad) > 0) {
                    hayProductoValido = true;
                    if (!evidencia) {
                        cantidadSinEvidencia = true;
                    }
                }
            });

            const comentario = document.querySelector("textarea[name='incidencia_comentario']")?.value.trim();
            const evidenciaComentarioInput = document.querySelector("input[name='incidencia_evidencia']");
            const evidenciaComentarioArchivo = evidenciaComentarioInput?.files[0];

            const hayComentario = !!comentario;
            const hayEvidenciaComentario = !!evidenciaComentarioArchivo;

            // DEBUG: consola
            console.log("Comentario:", comentario);
            console.log("Evidencia archivo:", evidenciaComentarioArchivo);
            console.log("Tamaño:", evidenciaComentarioArchivo?.size);

            // Casos separados
            if (hayComentario && !hayEvidenciaComentario) {
                e.preventDefault();
                alert("⚠️ Escribiste un comentario, pero falta adjuntar la evidencia.");
                return;
            }

            if (!hayComentario && hayEvidenciaComentario) {
                e.preventDefault();
                alert("⚠️ Adjuntaste evidencia, pero olvidaste escribir el comentario.");
                return;
            }

            if (cantidadSinEvidencia) {
                e.preventDefault();
                alert("⚠️ Ingresaste una cantidad sin adjuntar su evidencia correspondiente.");
                return;
            }

            if (!hayProductoValido && !hayComentario && !hayEvidenciaComentario) {
                e.preventDefault();
                alert("⚠️ Debes ingresar al menos una cantidad con evidencia o un comentario con evidencia.");
                return;
            }

            // TODO: mensaje opcional de éxito o dejar que pase el submit
        });
    }
});